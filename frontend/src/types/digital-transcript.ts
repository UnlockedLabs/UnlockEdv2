import { getActiveDigitalTranscriptStorageBasePath } from '@/pages/student/digital-transcript/digitalTranscriptRoutes';
import { resolveLearningRecordPrototype } from '@/pages/student/digital-transcript/learningRecordPrototypes';

/** Pre–variant-split keys (one-time migration into current keys) */
export const DIGITAL_TRANSCRIPT_LEGACY_STORAGE = {
    draft: 'unlockEd_digital_transcript_draft_v1',
    entries: 'unlockEd_digital_transcript_entries_v1'
} as const;

/** Removed variant B — keys formerly used for the guided `/my-transcript` flow */
const DIGITAL_TRANSCRIPT_B_STORAGE = {
    draft: 'unlockEd_digital_transcript_draft_v1_b',
    entries: 'unlockEd_digital_transcript_entries_v1_b'
} as const;

/** Prior A-only keys — removed on load so bumping A version clears resident data */
const STALE_TRANSCRIPT_A_STORAGE_KEYS = [
    'unlockEd_digital_transcript_draft_v1_a',
    'unlockEd_digital_transcript_entries_v1_a'
] as const;

export const TRANSCRIPT_ENTRY_SESSION_VERSION = 1 as const;

/** Multi-row achievement editor session (entry page); debounced to localStorage */
export interface TranscriptEntrySession {
    version: typeof TRANSCRIPT_ENTRY_SESSION_VERSION;
    rows: TranscriptEntry[];
    expandedId: string | null;
    lastPreviewId: string | null;
}

const FUNNEL_STORAGE_KEYS = {
    draft: 'unlockEd_digital_transcript_draft_v2_a',
    entries: 'unlockEd_digital_transcript_entries_v2_a',
    entrySession: 'unlockEd_digital_transcript_entry_session_v1_a'
} as const;

const CATEGORIES_STORAGE_KEYS = {
    draft: 'unlockEd_digital_transcript_draft_v2_categories',
    entries: 'unlockEd_digital_transcript_entries_v2_categories',
    entrySession: 'unlockEd_digital_transcript_entry_session_v1_categories'
} as const;

export function getDigitalTranscriptStorageKeys() {
    const proto = resolveLearningRecordPrototype(getActiveDigitalTranscriptStorageBasePath());
    if (proto.storageSuffix === 'categories') {
        return CATEGORIES_STORAGE_KEYS;
    }
    return FUNNEL_STORAGE_KEYS;
}

/** Drops abandoned Transcript A buckets after a storage version bump */
export function removeStaleTranscriptAStorage() {
    if (typeof localStorage === 'undefined') return;
    for (const key of STALE_TRANSCRIPT_A_STORAGE_KEYS) {
        localStorage.removeItem(key);
    }
}

function migrateVariantBIntoCurrent() {
    if (typeof localStorage === 'undefined') return;
    const keys = getDigitalTranscriptStorageKeys();
    const bDraft = localStorage.getItem(DIGITAL_TRANSCRIPT_B_STORAGE.draft);
    if (bDraft && !localStorage.getItem(keys.draft)) {
        localStorage.setItem(keys.draft, bDraft);
    }
    const bEntries = localStorage.getItem(DIGITAL_TRANSCRIPT_B_STORAGE.entries);
    if (bEntries) {
        const aRaw = localStorage.getItem(keys.entries);
        const aEmpty = !aRaw || aRaw === '[]';
        if (aEmpty) {
            localStorage.setItem(keys.entries, bEntries);
        }
    }
    localStorage.removeItem(DIGITAL_TRANSCRIPT_B_STORAGE.draft);
    localStorage.removeItem(DIGITAL_TRANSCRIPT_B_STORAGE.entries);
}

/**
 * If legacy unprefixed keys still hold data and the current bucket is empty,
 * copy into current keys so existing testers keep drafts/entries, then drop legacy.
 */
export function migrateDigitalTranscriptLegacyStorage() {
    if (typeof localStorage === 'undefined') return;

    removeStaleTranscriptAStorage();
    migrateVariantBIntoCurrent();

    const proto = resolveLearningRecordPrototype(getActiveDigitalTranscriptStorageBasePath());
    if (proto.storageSuffix !== 'funnel') return;

    const legDraft = localStorage.getItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft);
    const keys = getDigitalTranscriptStorageKeys();

    if (legDraft) {
        const empty = !localStorage.getItem(keys.draft);
        if (empty) {
            localStorage.setItem(keys.draft, legDraft);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft);
        }
    }

    const legEntries = localStorage.getItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries);
    if (legEntries) {
        const empty =
            !localStorage.getItem(keys.entries) || localStorage.getItem(keys.entries) === '[]';
        if (empty) {
            localStorage.setItem(keys.entries, legEntries);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries);
        }
    }
}

export type TranscriptUiPhase = 'survey' | 'preview';

/** Funnel Q4 — standout moment or person toggle. */
export type TranscriptQ4Toggle = 'yes' | 'notReally';

/** Shared funnel reflection fields (Q4–Q9). */
export interface TranscriptFunnelReflectionFields {
    q4Toggle: TranscriptQ4Toggle | null;
    q4Text: string;
    q5BeforeTags: string[];
    q5AfterTags: string[];
    q5FreeText: string;
    q7Text: string;
    q8Selections: string[];
    q9Selections: string[];
}

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
    /** Up to 5 skill / knowledge tags for this program (Q1). */
    topSkills: string[];
    /** "What made you finish it?" — open text */
    whatMadeYouFinish: string;
    goalConnection: string;
    pride: string;
    standoutMoment: string;
    adviceToPeer: string;
    q4Toggle: TranscriptQ4Toggle | null;
    q4Text: string;
    q5BeforeTags: string[];
    q5AfterTags: string[];
    q5FreeText: string;
    q7Text: string;
    q8Selections: string[];
    q9Selections: string[];
    /** When set, tapping Done updates this saved entry instead of creating a new one. */
    editingEntryId?: string;
}

/** Committed achievement shown on HOME */
export interface TranscriptEntry {
    id: string;
    createdAt: string;
    programName: string;
    completionDate: string;
    confidence: string;
    oneSentence: string;
    /** Up to 5 skill / knowledge tags for this program (Q1). */
    topSkills: string[];
    /** "What made you finish it?" — open text */
    whatMadeYouFinish: string;
    goalConnection: string;
    pride: string;
    standoutMoment: string;
    adviceToPeer: string;
    q4Toggle: TranscriptQ4Toggle | null;
    q4Text: string;
    q5BeforeTags: string[];
    q5AfterTags: string[];
    q5FreeText: string;
    q7Text: string;
    q8Selections: string[];
    q9Selections: string[];
}
