import type { TranscriptDraft } from '@/types/digital-transcript';
import {
    countFunnelFieldsAnswered,
    FUNNEL_FORM_FIELD_TOTAL,
    FUNNEL_FORM_STEP_COUNT,
    isFunnelStepComplete
} from './transcriptReflectionConfig';
import type { LearningRecordFormVariant } from './learningRecordPrototypes';

/** Fields rendered in the live document / print view. */
export type LearningRecordDocumentSource = Pick<
    TranscriptDraft,
    | 'programName'
    | 'completionDate'
    | 'confidence'
    | 'topSkills'
    | 'whatMadeYouFinish'
    | 'goalConnection'
    | 'pride'
    | 'standoutMoment'
    | 'adviceToPeer'
    | 'oneSentence'
    | 'q4Toggle'
    | 'q4Text'
    | 'q5BeforeTags'
    | 'q5AfterTags'
    | 'q5FreeText'
    | 'q7Text'
    | 'q8Selections'
    | 'q9Selections'
>;

export type LearningRecordPreviewState = 'empty' | 'partial' | 'complete';

const REFLECTION_SLOT_COUNT = 8;

function slotTopSkills(source: LearningRecordDocumentSource): boolean {
    return source.topSkills.length > 0;
}

function slotConfidence(source: LearningRecordDocumentSource): boolean {
    return /^[1-5]$/.test(source.confidence.trim());
}

function slotText(s: string): boolean {
    return Boolean(s.trim());
}

export function isProgramSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.programName);
}

export function isCompletedSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.completionDate);
}

export function isConfidenceSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotConfidence(source);
}

export function isSkillsSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotTopSkills(source);
}

export function isHeadlineSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.oneSentence);
}

export function isPrideSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.pride);
}

export function isStandoutSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.standoutMoment);
}

export function isFinishSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.whatMadeYouFinish);
}

export function isConnectsSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.goalConnection);
}

export function isAdviceSectionFilled(
    source: LearningRecordDocumentSource
): boolean {
    return slotText(source.adviceToPeer);
}

export function hasFilledNarrativeSections(
    source: LearningRecordDocumentSource
): boolean {
    return (
        isHeadlineSectionFilled(source) ||
        isPrideSectionFilled(source) ||
        isStandoutSectionFilled(source) ||
        isFinishSectionFilled(source) ||
        isConnectsSectionFilled(source) ||
        isAdviceSectionFilled(source)
    );
}

/** Funnel preview — narrative column has any answered reflection field. */
export function hasFilledFunnelReflectionSections(
    source: LearningRecordDocumentSource
): boolean {
    return (
        slotText(source.whatMadeYouFinish) ||
        source.q4Toggle === 'yes' ||
        source.q5BeforeTags.length > 0 ||
        source.q5AfterTags.length > 0 ||
        slotText(source.q5FreeText) ||
        slotText(source.adviceToPeer) ||
        slotConfidence(source) ||
        slotText(source.q7Text) ||
        source.q8Selections.length > 0 ||
        source.q9Selections.length > 0 ||
        slotText(source.oneSentence)
    );
}

export function hasFilledMetadataSections(
    source: LearningRecordDocumentSource
): boolean {
    return (
        isProgramSectionFilled(source) ||
        isCompletedSectionFilled(source) ||
        isConfidenceSectionFilled(source) ||
        isSkillsSectionFilled(source)
    );
}

/** Funnel preview — left column is program and completion date only. */
export function hasFilledFunnelMetadataSections(
    source: LearningRecordDocumentSource
): boolean {
    return isProgramSectionFilled(source) || isCompletedSectionFilled(source);
}

/** How many of the 8 reflection prompts have a meaningful answer (per-achievement readiness). */
export function countAnsweredReflections(
    source: LearningRecordDocumentSource
): number {
    let n = 0;
    if (slotTopSkills(source)) n++;
    if (slotText(source.whatMadeYouFinish)) n++;
    if (slotConfidence(source)) n++;
    if (slotText(source.pride)) n++;
    if (slotText(source.goalConnection)) n++;
    if (slotText(source.standoutMoment)) n++;
    if (slotText(source.adviceToPeer)) n++;
    if (slotText(source.oneSentence)) n++;
    return n;
}

export function reflectionSlotsTotal(): number {
    return REFLECTION_SLOT_COUNT;
}

const EDITOR_FORM_SLOT_COUNT = 10;

/** Ten editor fields: program, date, and all eight reflection prompts. */
export function countEditorFormSlots(
    source: LearningRecordDocumentSource
): number {
    let n = 0;
    if (slotText(source.programName)) n++;
    if (slotText(source.completionDate)) n++;
    if (slotTopSkills(source)) n++;
    if (slotText(source.whatMadeYouFinish)) n++;
    if (slotConfidence(source)) n++;
    if (slotText(source.pride)) n++;
    if (slotText(source.goalConnection)) n++;
    if (slotText(source.standoutMoment)) n++;
    if (slotText(source.adviceToPeer)) n++;
    if (slotText(source.oneSentence)) n++;
    return n;
}

export function editorFormSlotsTotal(): number {
    return EDITOR_FORM_SLOT_COUNT;
}

function hasAnyMetadata(source: LearningRecordDocumentSource): boolean {
    return Boolean(source.programName.trim() || source.completionDate.trim());
}

function isDocumentComplete(source: LearningRecordDocumentSource): boolean {
    return entryIsComplete(source, 'categories');
}

/** True when every required question for the form variant has been answered. */
export function entryIsComplete(
    source: LearningRecordDocumentSource,
    variant: LearningRecordFormVariant = 'categories'
): boolean {
    if (variant === 'funnel') {
        return countFunnelFieldsAnswered(source) === FUNNEL_FORM_FIELD_TOTAL;
    }
    return countEditorFormSlots(source) === editorFormSlotsTotal();
}

/** First funnel step index with unanswered required fields, or 0 if all complete. */
export function firstIncompleteFunnelStep(
    source: LearningRecordDocumentSource
): number {
    for (let i = 0; i < FUNNEL_FORM_STEP_COUNT; i++) {
        if (!isFunnelStepComplete(i, source)) return i;
    }
    return 0;
}

/**
 * Empty: no metadata and no reflections started.
 * Complete: program, date, and all eight reflection slots filled.
 * Partial: everything else.
 */
export function getLearningRecordPreviewState(
    source: LearningRecordDocumentSource
): LearningRecordPreviewState {
    const answered = countAnsweredReflections(source);
    if (!hasAnyMetadata(source) && answered === 0) return 'empty';
    if (isDocumentComplete(source)) return 'complete';
    return 'partial';
}
