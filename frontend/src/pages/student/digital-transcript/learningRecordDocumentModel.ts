import type { TranscriptDraft } from '@/types/digital-transcript';

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

export function isProgramSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.programName);
}

export function isCompletedSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.completionDate);
}

export function isConfidenceSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotConfidence(source);
}

export function isSkillsSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotTopSkills(source);
}

export function isHeadlineSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.oneSentence);
}

export function isPrideSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.pride);
}

export function isStandoutSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.standoutMoment);
}

export function isFinishSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.whatMadeYouFinish);
}

export function isConnectsSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.goalConnection);
}

export function isAdviceSectionFilled(source: LearningRecordDocumentSource): boolean {
    return slotText(source.adviceToPeer);
}

export function hasFilledNarrativeSections(source: LearningRecordDocumentSource): boolean {
    return (
        isHeadlineSectionFilled(source) ||
        isPrideSectionFilled(source) ||
        isStandoutSectionFilled(source) ||
        isFinishSectionFilled(source) ||
        isConnectsSectionFilled(source) ||
        isAdviceSectionFilled(source)
    );
}

/** Funnel preview — all reflection fields live in the right column. */
export function hasFilledFunnelReflectionSections(
    source: LearningRecordDocumentSource
): boolean {
    return (
        hasFilledNarrativeSections(source) ||
        isConfidenceSectionFilled(source) ||
        isSkillsSectionFilled(source)
    );
}

export function hasFilledMetadataSections(source: LearningRecordDocumentSource): boolean {
    return (
        isProgramSectionFilled(source) ||
        isCompletedSectionFilled(source) ||
        isConfidenceSectionFilled(source) ||
        isSkillsSectionFilled(source)
    );
}

/** Funnel preview — left column is program and completion date only. */
export function hasFilledFunnelMetadataSections(source: LearningRecordDocumentSource): boolean {
    return isProgramSectionFilled(source) || isCompletedSectionFilled(source);
}

/** How many of the 8 reflection prompts have a meaningful answer (per-achievement readiness). */
export function countAnsweredReflections(source: LearningRecordDocumentSource): number {
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
export function countEditorFormSlots(source: LearningRecordDocumentSource): number {
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
    return (
        Boolean(source.programName.trim()) &&
        Boolean(source.completionDate.trim()) &&
        countAnsweredReflections(source) === REFLECTION_SLOT_COUNT
    );
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
