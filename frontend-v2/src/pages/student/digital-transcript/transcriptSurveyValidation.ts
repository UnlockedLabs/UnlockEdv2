import type { TranscriptDraft } from '@/types/digital-transcript';

/** Step indices 4–7 are questions 4–7 (after Q3); answers optional if the resident skips. */
export const FIRST_SKIPPABLE_STEP_INDEX = 4;

export function getSkipPatchForStep(stepIndex: number): Partial<TranscriptDraft> | null {
    switch (stepIndex) {
        case 4:
            return { goalConnection: '' };
        case 5:
            return { pride: '' };
        case 6:
            return { standoutMoment: '' };
        case 7:
            return { adviceToPeer: '' };
        default:
            return null;
    }
}

export function validateTranscriptStep(stepIndex: number, d: TranscriptDraft): boolean {
    switch (stepIndex) {
        case 0:
            return d.programName.trim().length > 0 && d.completionDate.trim().length > 0;
        case 1:
            return /^[1-5]$/.test(d.confidence);
        case 2:
            return d.oneSentence.trim().length > 0;
        case 3:
            return d.skillKnowledge.trim().length > 0;
        case 4:
            return d.goalConnection.trim().length > 0;
        case 5:
            return d.pride.trim().length > 0;
        case 6:
            return d.standoutMoment.trim().length > 0;
        case 7:
            return d.adviceToPeer.trim().length > 0;
        default:
            return false;
    }
}
