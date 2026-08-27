import { ANALYTICS_EVENTS, captureEvent, flowTimerSeconds } from '@/lib/events';
import { getDigitalTranscriptStorageKeys } from '@/types/digital-transcript';
import {
    noteEntryCompleted,
    noteEntryStarted,
    sessionStartMs
} from './learningRecordSession';

/**
 * Row ids already counted as a completed achievement.
 *
 * `this.completed` guards only one `entryStarted` -> `entryCompleted` pass, and
 * the tracker is rebuilt whenever the editor remounts — so re-opening a saved
 * achievement and pressing Finish again emitted a second `lr_entry_completed`
 * with nothing on the payload to tell the two apart. "Do residents stop at one
 * or add more" then reads an edit as a new achievement, which can invert the
 * finding the tile exists to produce.
 *
 * Deduping here rather than putting the row id on the event keeps the payload to
 * counts, booleans and enums: the ids never leave the browser. `localStorage` is
 * right for this one (unlike the sitting record) because a resident editing an
 * old achievement in another tab must not be counted twice either.
 */
const COUNTED_ENTRIES_CAP = 500;

function readCountedEntries(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(
            getDigitalTranscriptStorageKeys().countedEntries
        );
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
        return [];
    }
}

function entryAlreadyCounted(rowId: string): boolean {
    return readCountedEntries().includes(rowId);
}

/**
 * Editing time banked against an achievement that is not finished yet, in ms.
 *
 * `entryStarted` re-bases `entryStartMs`, and it fires again when the resident
 * returns to the same achievement after a route change — so
 * `lr_entry_completed.duration_seconds` reports only the *final* visit and
 * systematically understates how long an entry actually took. That is the number
 * the facilitator cross-reference leans on, so the total is banked here per row
 * and emitted as `cumulative_seconds` alongside it. `duration_seconds` keeps its
 * meaning, so nothing already flowing is redefined.
 */
const ENTRY_TIMING_CAP = 200;

/**
 * Same cutoff and rationale as `learningRecordSession.ts`'s `ACTIVE_IDLE_MS`,
 * applied per visit: an achievement left open on an unattended screen stops
 * accruing `cumulative_seconds` this long after the resident's last keystroke,
 * rather than counting all the way to `Date.now()`.
 */
const ENTRY_ACTIVE_IDLE_MS = 5 * 60 * 1000;

function readEntryTiming(): Record<string, number> {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(
            getDigitalTranscriptStorageKeys().entryTiming
        );
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
                out[k] = v;
            }
        }
        return out;
    } catch {
        return {};
    }
}

function writeEntryTiming(next: Record<string, number>): void {
    if (typeof localStorage === 'undefined') return;
    try {
        const keys = Object.keys(next);
        const trimmed =
            keys.length > ENTRY_TIMING_CAP
                ? Object.fromEntries(
                      keys.slice(-ENTRY_TIMING_CAP).map((k) => [k, next[k]])
                  )
                : next;
        localStorage.setItem(
            getDigitalTranscriptStorageKeys().entryTiming,
            JSON.stringify(trimmed)
        );
    } catch {
        // Quota or private mode: `cumulative_seconds` falls back to this visit
        // only, which is what `duration_seconds` already reports.
    }
}

function bankEntryActiveMs(rowId: string, ms: number): void {
    if (ms <= 0) return;
    const all = readEntryTiming();
    all[rowId] = (all[rowId] ?? 0) + ms;
    writeEntryTiming(all);
}

/** Read and clear — a finished achievement has no more time to accumulate. */
function takeEntryActiveMs(rowId: string): number {
    const all = readEntryTiming();
    const banked = all[rowId] ?? 0;
    if (rowId in all) {
        delete all[rowId];
        writeEntryTiming(all);
    }
    return banked;
}

function markEntryCounted(rowId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
        const next = [...readCountedEntries(), rowId].slice(
            -COUNTED_ENTRIES_CAP
        );
        localStorage.setItem(
            getDigitalTranscriptStorageKeys().countedEntries,
            JSON.stringify(next)
        );
    } catch {
        // Quota or private mode. Falls back to the per-pass `completed` guard,
        // which still stops a double Finish inside one visit.
    }
}
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
    /**
     * Quiet time between the resident's previous keystroke anywhere in this step
     * — or the step opening, for the first question they engage — and their first
     * keystroke here.
     *
     * `duration_seconds` is a typing span, so a question someone stared at for
     * three minutes and answered in ten seconds reports ten. That makes the
     * criterion's "surface which questions take unusually long" blind to exactly
     * the questions it is asking about, because hesitation is where confusion
     * shows. This is the hesitation, measured from data already collected: no
     * focus handlers, no coupling to the form's markup.
     */
    beforeFirstEditMs: number;
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
    /**
     * The resident's most recent keystroke on any question in the current step,
     * or null before they have typed anything in it. The reference point for the
     * next question's `beforeFirstEditMs`.
     */
    private lastAnyEditMs: number | null = null;
    /** Reference point for `cappedElapsedMs`'s idle cutoff. */
    private lastActivityMs = Date.now();
    /** The achievement being edited, so partial time can be banked against it. */
    private entryRowId: string | null = null;
    /** Set by `entryCompleted`, so a second Finish cannot emit a duplicate. */
    private completed = false;

    /**
     * Called once when the form becomes interactive.
     *
     * The index comes from `learningRecordSession`, not from the caller: it used
     * to be derived from a ref in the form, which was rebuilt on every mount, so
     * a resident returning from the list to add a second achievement reported
     * index 1 again. It now counts across the whole sitting.
     */
    entryStarted(rowId?: string): void {
        this.entryRowId = rowId ?? null;
        this.entryStartMs = Date.now();
        this.stepStartMs = Date.now();
        this.timings.clear();
        this.lastAnyEditMs = null;
        this.lastActivityMs = this.entryStartMs;
        this.currentField = null;
        this.touched.clear();
        this.reportedSteps.clear();
        // Matches the form's `activeStep` state, which is always 0 on a fresh entry.
        this.currentStepIndex = 0;
        this.completed = false;

        // Already saved in an earlier visit: this open is an edit, not a new
        // achievement. Skipping the counter bump as well as the emit — not just
        // the emit — keeps `entries_started` and `entries_completed` on
        // `lr_session_ended` counting the same population; otherwise a resident
        // who reopens one saved achievement twice reports 3 started against 1
        // completed.
        if (rowId && entryAlreadyCounted(rowId)) return;

        this.entryIndex = noteEntryStarted();
        captureEvent(ANALYTICS_EVENTS.LrEntryStarted, {
            entry_index_in_session: this.entryIndex
        });
    }

    /**
     * Called when a bfcache restore silently starts a new sitting
     * (`learning-record-session-restarted`) while this component — and this
     * tracker — never unmounted. `entryStarted` never re-ran for the row
     * already open, so `entryIndex` is still numbered against the sitting
     * that just ended. Re-numbers it against the new one and reports the
     * corresponding `lr_entry_started`, mirroring what a genuine remount
     * would have produced. Question/step timing already accumulated is left
     * untouched — the resident's editing was never actually interrupted,
     * only the sitting's own bookkeeping was.
     */
    reattachToSession(rowId: string | null): void {
        if (this.completed) return;
        if (!rowId || rowId !== this.entryRowId) return;
        this.entryIndex = noteEntryStarted();
        captureEvent(ANALYTICS_EVENTS.LrEntryStarted, {
            entry_index_in_session: this.entryIndex
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
            // First keystroke on this question. Measured before `lastAnyEditMs`
            // is advanced below, so the reference is still the previous
            // question's last edit.
            this.timings.set(field, {
                openMs: now,
                lastEditMs: now,
                totalMs: 0,
                beforeFirstEditMs: Math.max(
                    0,
                    now - (this.lastAnyEditMs ?? this.stepStartMs)
                )
            });
        }
        this.lastAnyEditMs = now;
        this.lastActivityMs = now;
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
     * Elapsed time for the current visit, capped the same way
     * `learningRecordSession.ts` caps `active_seconds`: an unattended tab stops
     * accruing `ENTRY_ACTIVE_IDLE_MS` after the resident's last keystroke instead
     * of counting all the way to now.
     */
    private cappedElapsedMs(): number {
        const end = Math.min(
            Date.now(),
            this.lastActivityMs + ENTRY_ACTIVE_IDLE_MS
        );
        return Math.max(0, end - this.entryStartMs);
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
        this.lastAnyEditMs = null;
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
        durationSeconds: number,
        abandoned = false
    ): void {
        const step = FUNNEL_FORM_STEPS[stepIndex];
        if (!step || this.reportedSteps.has(stepIndex)) return;
        this.reportedSteps.add(stepIndex);

        let answered = 0;
        for (const field of step.fields) {
            if (funnelStepFieldAnswered(entry, field)) answered += 1;
            this.emitQuestion(entry, field, abandoned);
        }
        captureEvent(ANALYTICS_EVENTS.LrStepCompleted, {
            step_id: step.id,
            step_index: stepIndex,
            duration_seconds: durationSeconds,
            answered_count: answered,
            abandoned
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
    entryCompleted(entry: TranscriptReflectionFields, rowId?: string): boolean {
        if (this.completed) return false;
        // Already counted in an earlier visit or another tab: this Finish is an
        // edit to an existing achievement, not a new one. Returning before the
        // flush also keeps its questions and steps from being reported twice.
        // No `lr_entry_completed` will ever fire for this row again, so any time
        // `abandonedCurrentStep` banked against it on a later re-open must be
        // discarded here — otherwise it sits in `entryTiming` forever, unread.
        if (rowId && entryAlreadyCounted(rowId)) {
            takeEntryActiveMs(rowId);
            return false;
        }
        this.completed = true;
        if (rowId) markEntryCounted(rowId);
        noteEntryCompleted();

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
            cumulative_seconds: Math.round(
                ((rowId ? takeEntryActiveMs(rowId) : 0) +
                    this.cappedElapsedMs()) /
                    1000
            ),
            answered_count: countFunnelFieldsAnswered(entry),
            total_fields: FUNNEL_FORM_FIELD_TOTAL,
            entry_index_in_session: this.entryIndex,
            seconds_since_session_start: flowTimerSeconds(sessionStartMs()),
            submitted_at: new Date().toISOString()
        });
        return true;
    }

    /**
     * Report the step the resident was standing on when they left without
     * finishing.
     *
     * `stepChanged` reports a step only when it is left *for another one*, and
     * `entryCompleted` flushes everything at the end — so abandoning on the step
     * in front of you was the one case that emitted nothing. That is both the
     * sharpest friction signal in the form and the population criterion 3 needs
     * for its "left it blank" denominator, so it cannot be the case that goes
     * unreported.
     *
     * Only the current step is flushed. Steps never visited are left alone: they
     * would arrive as rows of zeros and invent a denominator the resident never
     * actually saw.
     *
     * Rows emitted here carry `abandoned: true`. A resident who leaves and comes
     * back re-opens the entry, which clears `reportedSteps`, so the same step can
     * be reported again later — once here and once at finish. The flag is what
     * lets a timing tile exclude the partial row while an answer-rate tile keeps
     * it, instead of the duplication being silent.
     */
    abandonedCurrentStep(entry: TranscriptReflectionFields): void {
        // No entry was ever opened for editing, so there is no step the resident
        // can be said to have abandoned. Also keeps React StrictMode's discarded
        // first mount from emitting anything.
        if (this.entryIndex === 0 || this.completed) return;
        // Unfinished: bank this visit so a later Finish can report the total.
        if (this.entryRowId) {
            bankEntryActiveMs(this.entryRowId, this.cappedElapsedMs());
        }
        if (this.currentField) this.closeRun(this.currentField);
        this.currentField = null;
        this.reportStep(
            entry,
            this.currentStepIndex,
            flowTimerSeconds(this.stepStartMs),
            true
        );
    }

    /**
     * The single emitter for `lr_question_left`. `touched` is derived here
     * rather than passed in, so no caller can reintroduce a second event for a
     * question that was already reported.
     */
    private emitQuestion(
        entry: TranscriptReflectionFields,
        field: FunnelStepField,
        abandoned = false
    ): void {
        this.closeRun(field);
        const timing = this.timings.get(field);
        // Untouched questions report 0 seconds and touched=false so time charts
        // can exclude them while selection-rate charts still count them.
        const duration = timing ? Math.round(timing.totalMs / 1000) : 0;
        captureEvent(ANALYTICS_EVENTS.LrQuestionLeft, {
            question_key: field,
            // null, not 0, when the question was never typed in: there is no
            // hesitation to report, and 0 would read as "answered instantly".
            seconds_before_first_edit: timing
                ? Math.round(timing.beforeFirstEditMs / 1000)
                : null,
            step_id: stepIdForField(field),
            kind: funnelStepFieldKind(field),
            duration_seconds: duration,
            touched: this.touched.has(field),
            answered: funnelStepFieldAnswered(entry, field),
            selection_count: selectionCount(entry, field),
            char_count: charCount(entry, field),
            abandoned
        });
    }
}

function stepIdForField(field: FunnelStepField): string {
    const step = FUNNEL_FORM_STEPS.find((s) => s.fields.includes(field));
    return step?.id ?? 'unknown';
}
