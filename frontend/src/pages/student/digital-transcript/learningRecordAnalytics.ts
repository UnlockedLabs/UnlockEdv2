import { ANALYTICS_EVENTS, captureEvent, flowTimerSeconds } from '@/lib/events';
import {
    FUNNEL_FORM_FIELD_TOTAL,
    FUNNEL_FORM_STEPS,
    countFunnelFieldsAnswered,
    funnelStepFieldAnswered,
    funnelStepFieldKind,
    type FunnelStepField,
    type TranscriptReflectionFields
} from './transcriptReflectionConfig';

/**
 * Question-level behavior tracking for the Learning Record form (ID-806).
 *
 * The pilot's SQL over `learning_record_entries` shows *what* residents saved but
 * not *how* they worked: which questions took unusually long, which chip
 * selectors were engaged versus skipped, how many entries someone adds in a
 * sitting. These events supply that.
 *
 * PRIVACY — this module is the only place that reads entry values, and it reads
 * exclusively lengths, counts and booleans. Resident consent language promises
 * anonymized aggregate data, so no answer text may ever become an event
 * property. Anything added here must stay a number, boolean, or fixed enum.
 *
 * The tracker is deliberately driven from two logic choke points in the form
 * (`patchRow` for edits, `handleActiveStepChange` for navigation) rather than
 * from per-field focus/blur handlers, so it does not depend on the form's
 * markup.
 */

/** How many options are selected for a multi-select question. */
function selectionCount(
    entry: TranscriptReflectionFields,
    field: FunnelStepField
): number {
    switch (field) {
        case 'q5':
            return entry.q5BeforeTags.length + entry.q5AfterTags.length;
        case 'q8Selections':
            return entry.q8Selections.length;
        case 'q9Selections':
            return entry.q9Selections.length;
        default:
            return 0;
    }
}

/** Length only — never the content. */
function charCount(
    entry: TranscriptReflectionFields,
    field: FunnelStepField
): number {
    switch (field) {
        case 'programName':
            return entry.programName.trim().length;
        case 'whatMadeYouFinish':
            return entry.whatMadeYouFinish.trim().length;
        case 'adviceToPeer':
            return entry.adviceToPeer.trim().length;
        case 'oneSentence':
            return entry.oneSentence.trim().length;
        case 'q4':
            return entry.q4Text.trim().length;
        case 'q5':
            return entry.q5FreeText.trim().length;
        default:
            return 0;
    }
}

/** Maps a mutated draft key back to the step field it belongs to. */
const PATCH_KEY_TO_FIELD: Partial<Record<string, FunnelStepField>> = {
    programName: 'programName',
    completionDate: 'completionDate',
    whatMadeYouFinish: 'whatMadeYouFinish',
    q4Toggle: 'q4',
    q4Text: 'q4',
    q5BeforeTags: 'q5',
    q5AfterTags: 'q5',
    q5FreeText: 'q5',
    adviceToPeer: 'adviceToPeer',
    confidence: 'confidence',
    q8Selections: 'q8Selections',
    q9Selections: 'q9Selections',
    oneSentence: 'oneSentence'
};

function funnelFieldForPatchKey(key: string): FunnelStepField | null {
    return PATCH_KEY_TO_FIELD[key] ?? null;
}

interface QuestionTiming {
    /** Start of the editing run in progress, or null when no run is open. */
    openMs: number | null;
    lastEditMs: number;
    /** Sum of every closed editing run for this question, in ms. */
    totalMs: number;
}

/**
 * Per-entry tracker. One instance per form mount; `entryStarted()` begins a new
 * entry and clears the previous one's state.
 * Not a hook — the form holds it in a ref so it survives re-renders.
 *
 * Every `lr_question_left` for an entry comes from `stepChanged` or
 * `entryCompleted`, exactly once per question. `noteEdit` only accumulates
 * timing.
 */
export class LearningRecordTracker {
    private entryStartMs = Date.now();
    /**
     * Start of the current visit to the form, re-based by `beginSession` — so
     * `seconds_since_session_start` measures from when the resident opened the
     * form, not from when they opened the first entry. Never reset by
     * `entryStarted`, so it stays comparable across entries in one sitting.
     */
    private sessionStartMs = Date.now();
    private entryIndex = 0;
    /** Accumulated editing time per question, for the entry in progress. */
    private timings = new Map<FunnelStepField, QuestionTiming>();
    /** Question currently being edited, so its run can be closed on switch. */
    private currentField: FunnelStepField | null = null;
    /** Fields edited at least once during this entry. */
    private touched = new Set<FunnelStepField>();
    /** Steps already reported, so re-visiting a step does not double count. */
    private reportedSteps = new Set<number>();
    /**
     * The step currently on screen. Tracked so `entryCompleted` can charge the
     * elapsed step time to the step the resident is actually standing on, and zero
     * to steps it is flushing that were never visited.
     */
    private currentStepIndex = 0;
    private stepStartMs = Date.now();
    /** Set by `entryCompleted`, so a second Finish cannot emit a duplicate. */
    private completed = false;
    /** Entries actually saved this session, reported by `endSession`. */
    private entriesCompleted = 0;
    /** One-shot guard for `endSession`, re-armed by `beginSession`. */
    private sessionEndSent = false;

    /**
     * Opens a session window. Called when the form's session effect mounts — which
     * React StrictMode does twice in development, discarding the first cycle;
     * without re-arming the one-shot, that throwaway cleanup would latch the guard
     * and suppress the real session-end event.
     *
     * Re-bases everything `endSession` reports, not just the one-shot. Its cleanup
     * always emits, so by the time this runs any earlier window has already been
     * reported — carrying that window's start time or entry count forward would
     * double count it into the next event. StrictMode walks exactly that path
     * (mount → cleanup emits → mount), and so would `isFunnel` flipping while the
     * component stays mounted. Per-entry state is deliberately left alone; that
     * belongs to `entryStarted`.
     */
    beginSession(): void {
        this.sessionEndSent = false;
        this.sessionStartMs = Date.now();
        this.entriesCompleted = 0;
    }

    /**
     * Called once when the resident leaves the form, by either route: in-app
     * navigation or `pagehide`.
     *
     * This is the only measure of total time in the tool that includes residents
     * who never saved an entry — `seconds_since_session_start` rides on
     * `lr_entry_completed`, so an abandoned session is invisible to it, and that
     * is exactly the friction signal the pilot is looking for.
     */
    endSession(): void {
        if (this.sessionEndSent) return;
        this.sessionEndSent = true;
        captureEvent(ANALYTICS_EVENTS.LrSessionEnded, {
            duration_seconds: flowTimerSeconds(this.sessionStartMs),
            entries_completed: this.entriesCompleted
        });
    }

    /** Called once when the form becomes interactive. */
    entryStarted(entryIndexInSession: number): void {
        this.entryIndex = entryIndexInSession;
        this.entryStartMs = Date.now();
        this.stepStartMs = Date.now();
        this.timings.clear();
        this.currentField = null;
        this.touched.clear();
        this.reportedSteps.clear();
        // Matches the form's `activeStep` state, which is always 0 on a fresh entry.
        this.currentStepIndex = 0;
        this.completed = false;
        captureEvent(ANALYTICS_EVENTS.LrEntryStarted, {
            entry_index_in_session: entryIndexInSession
        });
    }

    /**
     * Called on every field mutation. Records timing only — it deliberately
     * emits nothing.
     *
     * `lr_question_left` is emitted exclusively by `stepChanged` /
     * `entryCompleted`, which is what guarantees exactly one event per question
     * per entry, carrying the values the resident actually left behind. When
     * this method also emitted, a question edited before the end of its step
     * produced two events — the second with `duration_seconds: 0` but
     * `touched: true` — which dragged the per-question median toward zero and
     * inflated the denominator for answer-rate charts.
     */
    noteEdit(patchKey: string): void {
        const field = funnelFieldForPatchKey(patchKey);
        if (!field) return;
        this.touched.add(field);

        const now = Date.now();
        if (this.currentField && this.currentField !== field) {
            this.closeRun(this.currentField);
        }
        const timing = this.timings.get(field);
        if (timing) {
            timing.openMs ??= now;
            timing.lastEditMs = now;
        } else {
            this.timings.set(field, {
                openMs: now,
                lastEditMs: now,
                totalMs: 0
            });
        }
        this.currentField = field;
    }

    /**
     * Folds an in-progress run into the question's total. The run ends at the
     * last keystroke, not at the moment of the switch, so idle time after the
     * resident stops typing is not charged to the question.
     */
    private closeRun(field: FunnelStepField): void {
        const timing = this.timings.get(field);
        if (timing?.openMs == null) return;
        timing.totalMs += Math.max(0, timing.lastEditMs - timing.openMs);
        timing.openMs = null;
    }

    /**
     * Called when the visible step changes. Emits one `lr_question_left` per
     * field of the step being left — including untouched ones, so
     * "selected at least one option vs left blank" has a real denominator —
     * then `lr_step_completed`.
     */
    stepChanged(
        entry: TranscriptReflectionFields,
        fromStepIndex: number,
        toStepIndex: number
    ): void {
        if (this.currentField) this.closeRun(this.currentField);
        this.currentField = null;

        this.reportStep(
            entry,
            fromStepIndex,
            flowTimerSeconds(this.stepStartMs)
        );
        this.stepStartMs = Date.now();
        this.currentStepIndex = toStepIndex;
    }

    /**
     * Emits one `lr_question_left` per field of a step, then one
     * `lr_step_completed` for the step itself. Idempotent per entry: the
     * `reportedSteps` guard makes a second call for the same step a no-op, which is
     * what lets `entryCompleted` flush unconditionally without double counting.
     */
    private reportStep(
        entry: TranscriptReflectionFields,
        stepIndex: number,
        durationSeconds: number
    ): void {
        const step = FUNNEL_FORM_STEPS[stepIndex];
        if (!step || this.reportedSteps.has(stepIndex)) return;
        this.reportedSteps.add(stepIndex);

        let answered = 0;
        for (const field of step.fields) {
            if (funnelStepFieldAnswered(entry, field)) answered += 1;
            this.emitQuestion(entry, field);
        }
        captureEvent(ANALYTICS_EVENTS.LrStepCompleted, {
            step_id: step.id,
            step_index: stepIndex,
            duration_seconds: durationSeconds,
            answered_count: answered
        });
    }

    /**
     * Called when the resident finishes a complete entry, *after* the entry has
     * been persisted — a completion event for an entry that failed to save
     * would overstate the funnel.
     *
     * Returns false without emitting if this entry was already completed, so a
     * second Finish click cannot produce a duplicate.
     */
    entryCompleted(entry: TranscriptReflectionFields): boolean {
        if (this.completed) return false;
        this.completed = true;
        this.entriesCompleted += 1;

        if (this.currentField) this.closeRun(this.currentField);
        this.currentField = null;

        // Flush every step that has not reported yet, not just the final one.
        // `stepChanged` reports a step only when the resident *leaves* it, and two
        // paths dodge that. The progress card is an ungated tablist and `activeStep`
        // always starts at 0, so resuming a saved entry and jumping straight to the
        // last step leaves the middle step never reported at all — its questions
        // vanish from the answer-rate denominator this module exists to supply. And
        // the final step is never left, so before this it emitted `lr_question_left`
        // via a partial flush here but never an `lr_step_completed`, leaving it
        // absent from the step funnel on every single entry.
        //
        // Duration is real for the step on screen and 0 for steps never visited —
        // `stepStartMs` is one timestamp and means nothing for an unvisited step.
        for (let i = 0; i < FUNNEL_FORM_STEPS.length; i++) {
            this.reportStep(
                entry,
                i,
                i === this.currentStepIndex
                    ? flowTimerSeconds(this.stepStartMs)
                    : 0
            );
        }

        // Counted with the same helpers `entryIsComplete` uses, which exclude the
        // optional completionDate. The old local loop walked all of
        // FUNNEL_FORM_STEPS, so total_fields was 10 against a 9-field completion
        // requirement and answered_count could not reach it without a date —
        // capping any completion-rate insight built on the pair at 90%.
        captureEvent(ANALYTICS_EVENTS.LrEntryCompleted, {
            duration_seconds: flowTimerSeconds(this.entryStartMs),
            answered_count: countFunnelFieldsAnswered(entry),
            total_fields: FUNNEL_FORM_FIELD_TOTAL,
            entry_index_in_session: this.entryIndex,
            seconds_since_session_start: flowTimerSeconds(this.sessionStartMs),
            submitted_at: new Date().toISOString()
        });
        return true;
    }

    /**
     * The single emitter for `lr_question_left`. `touched` is derived here
     * rather than passed in, so no caller can reintroduce a second event for a
     * question that was already reported.
     */
    private emitQuestion(
        entry: TranscriptReflectionFields,
        field: FunnelStepField
    ): void {
        this.closeRun(field);
        const timing = this.timings.get(field);
        // Untouched questions report 0 seconds and touched=false so time charts
        // can exclude them while selection-rate charts still count them.
        const duration = timing ? Math.round(timing.totalMs / 1000) : 0;
        captureEvent(ANALYTICS_EVENTS.LrQuestionLeft, {
            question_key: field,
            step_id: stepIdForField(field),
            kind: funnelStepFieldKind(field),
            duration_seconds: duration,
            touched: this.touched.has(field),
            answered: funnelStepFieldAnswered(entry, field),
            selection_count: selectionCount(entry, field),
            char_count: charCount(entry, field)
        });
    }
}

function stepIdForField(field: FunnelStepField): string {
    const step = FUNNEL_FORM_STEPS.find((s) => s.fields.includes(field));
    return step?.id ?? 'unknown';
}
