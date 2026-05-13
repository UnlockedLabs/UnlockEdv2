/** Pre–variant-split keys (one-time migration into per-variant keys) */
export const DIGITAL_TRANSCRIPT_LEGACY_STORAGE = {
    draft: 'unlockEd_digital_transcript_draft_v1',
    entries: 'unlockEd_digital_transcript_entries_v1'
} as const;

export type DigitalTranscriptVariant = 'a' | 'b';

/** Prior A-only keys — removed on load so bumping A version clears resident A data */
const STALE_TRANSCRIPT_A_STORAGE_KEYS = [
    'unlockEd_digital_transcript_draft_v1_a',
    'unlockEd_digital_transcript_entries_v1_a'
] as const;

/** localStorage keys per transcript variant (A = WYSIWYG route, B = guided flow) */
export function getDigitalTranscriptStorageKeys(variant: DigitalTranscriptVariant) {
    if (variant === 'a') {
        return {
            draft: 'unlockEd_digital_transcript_draft_v2_a',
            entries: 'unlockEd_digital_transcript_entries_v2_a'
        } as const;
    }
    return {
        draft: 'unlockEd_digital_transcript_draft_v1_b',
        entries: 'unlockEd_digital_transcript_entries_v1_b'
    } as const;
}

/** Drops abandoned Transcript A buckets after a storage version bump */
export function removeStaleTranscriptAStorage() {
    if (typeof localStorage === 'undefined') return;
    for (const key of STALE_TRANSCRIPT_A_STORAGE_KEYS) {
        localStorage.removeItem(key);
    }
}

/**
 * If legacy unprefixed keys still hold data and both variant buckets are empty,
 * copy into A and B keys so existing testers keep drafts/entries, then drop legacy.
 */
export function migrateDigitalTranscriptLegacyStorage() {
    if (typeof localStorage === 'undefined') return;

    removeStaleTranscriptAStorage();

    const legDraft = localStorage.getItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft);
    const keysA = getDigitalTranscriptStorageKeys('a');
    const keysB = getDigitalTranscriptStorageKeys('b');

    if (legDraft) {
        const aEmpty = !localStorage.getItem(keysA.draft);
        const bEmpty = !localStorage.getItem(keysB.draft);
        if (aEmpty && bEmpty) {
            localStorage.setItem(keysA.draft, legDraft);
            localStorage.setItem(keysB.draft, legDraft);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft);
        }
    }

    const legEntries = localStorage.getItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries);
    if (legEntries) {
        const aEmpty =
            !localStorage.getItem(keysA.entries) || localStorage.getItem(keysA.entries) === '[]';
        const bEmpty =
            !localStorage.getItem(keysB.entries) || localStorage.getItem(keysB.entries) === '[]';
        if (aEmpty && bEmpty) {
            localStorage.setItem(keysA.entries, legEntries);
            localStorage.setItem(keysB.entries, legEntries);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries);
        }
    }
}

export type TranscriptUiPhase = 'survey' | 'preview';

/** In-progress survey + preview gate; persisted for autosave / resume */
export interface TranscriptDraft {
    id: string;
    updatedAt: string;
    stepIndex: number;
    uiPhase: TranscriptUiPhase;
    programName: string;
    completionDate: string;
    confidence: string;
    oneSentence: string;
    skillKnowledge: string;
    goalConnection: string;
    pride: string;
    standoutMoment: string;
    adviceToPeer: string;
}

/** Committed achievement shown on HOME */
export interface TranscriptEntry {
    id: string;
    createdAt: string;
    programName: string;
    completionDate: string;
    confidence: string;
    oneSentence: string;
    skillKnowledge: string;
    goalConnection: string;
    pride: string;
    standoutMoment: string;
    adviceToPeer: string;
}

export const TRANSCRIPT_STEP_COUNT = 8;
