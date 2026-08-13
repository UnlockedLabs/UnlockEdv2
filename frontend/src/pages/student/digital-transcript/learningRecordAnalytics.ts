import { ANALYTICS_EVENTS, captureEvent, flowTimerSeconds } from '@/lib/events';
import {
    FUNNEL_FORM_STEPS,
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
    field: FunnelStepField;
    startedMs: number;
    lastEditMs: number;
}

/**
 * Per-entry tracker. One instance per expanded entry; `reset()` starts a new one.
 * Not a hook — the form holds it in a ref so it survives re-renders.
 */
export class LearningRecordTracker {
    private entryStartMs = Date.now();
    /**
     * Set once at construction, which the form does on mount — so
     * `seconds_since_session_start` measures from when the resident opened the
     * form, not from when they opened the first entry. Never reset by
     * `entryStarted`, so it stays comparable across entries in one sitting.
     */
    private readonly sessionStartMs = Date.now();
    private entryIndex = 0;
    private current: QuestionTiming | null = null;
    /** Fields edited at least once during this entry. */
    private touched = new Set<FunnelStepField>();
    /** Steps already reported, so re-visiting a step does not double count. */
    private reportedSteps = new Set<number>();
    private stepStartMs = Date.now();

    /** Called once when the form becomes interactive. */
    entryStarted(entryIndexInSession: number): void {
        this.entryIndex = entryIndexInSession;
        this.entryStartMs = Date.now();
        this.stepStartMs = Date.now();
        this.current = null;
        this.touched.clear();
        this.reportedSteps.clear();
        captureEvent(ANALYTICS_EVENTS.LrEntryStarted, {
            entry_index_in_session: entryIndexInSession
        });
    }

    /**
     * Called on every field mutation. Emits `lr_question_left` for the previous
     * question when focus effectively moves to a different one.
     */
    noteEdit(entry: TranscriptReflectionFields, patchKey: string): void {
        const field = funnelFieldForPatchKey(patchKey);
        if (!field) return;
        this.touched.add(field);

        if (this.current && this.current.field !== field) {
            this.emitQuestion(entry, this.current.field, true);
        }
        const now = Date.now();
        if (this.current?.field !== field) {
            this.current = { field, startedMs: now, lastEditMs: now };
        } else {
            this.current.lastEditMs = now;
        }
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
        const from = FUNNEL_FORM_STEPS[fromStepIndex];
        if (from && !this.reportedSteps.has(fromStepIndex)) {
            this.reportedSteps.add(fromStepIndex);
            let answered = 0;
            for (const field of from.fields) {
                if (funnelStepFieldAnswered(entry, field)) answered += 1;
                this.emitQuestion(entry, field, this.touched.has(field));
            }
            captureEvent(ANALYTICS_EVENTS.LrStepCompleted, {
                step_id: from.id,
                step_index: fromStepIndex,
                duration_seconds: flowTimerSeconds(this.stepStartMs),
                answered_count: answered
            });
        }
        this.current = null;
        this.stepStartMs = Date.now();
        void toStepIndex;
    }

    /** Called when the resident finishes a complete entry. */
    entryCompleted(entry: TranscriptReflectionFields): void {
        // Flush the final step so its questions are represented too.
        const lastIndex = FUNNEL_FORM_STEPS.length - 1;
        const last = FUNNEL_FORM_STEPS[lastIndex];
        if (last && !this.reportedSteps.has(lastIndex)) {
            this.reportedSteps.add(lastIndex);
            for (const field of last.fields) {
                this.emitQuestion(entry, field, this.touched.has(field));
            }
        }
        this.current = null;

        let answered = 0;
        let total = 0;
        for (const step of FUNNEL_FORM_STEPS) {
            for (const field of step.fields) {
                total += 1;
                if (funnelStepFieldAnswered(entry, field)) answered += 1;
            }
        }

        captureEvent(ANALYTICS_EVENTS.LrEntryCompleted, {
            duration_seconds: flowTimerSeconds(this.entryStartMs),
            answered_count: answered,
            total_fields: total,
            entry_index_in_session: this.entryIndex,
            seconds_since_session_start: flowTimerSeconds(this.sessionStartMs),
            submitted_at: new Date().toISOString()
        });
    }

    private emitQuestion(
        entry: TranscriptReflectionFields,
        field: FunnelStepField,
        touched: boolean
    ): void {
        const kind = funnelStepFieldKind(field);
        const timing = this.current?.field === field ? this.current : null;
        // Untouched questions report 0 seconds and touched=false so time charts
        // can exclude them while selection-rate charts still count them.
        const duration = timing
            ? Math.max(
                  0,
                  Math.round((timing.lastEditMs - timing.startedMs) / 1000)
              )
            : 0;
        captureEvent(ANALYTICS_EVENTS.LrQuestionLeft, {
            question_key: field,
            step_id: stepIdForField(field),
            kind,
            duration_seconds: duration,
            touched,
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
