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

/**
 * Analytics sitting record (`learningRecordSession.ts`).
 *
 * Note the `session` keys below are read from **`sessionStorage`**, not
 * `localStorage` like every other key in this file — a clock must not be shared
 * between tabs the way draft content is. See `storageKey` in that module.
 */
export const LEARNING_RECORD_SESSION_VERSION = 1 as const;

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
    entrySession: 'unlockEd_digital_transcript_entry_session_v1_a',
    session: 'unlockEd_digital_transcript_session_v1_a',
    countedEntries: 'unlockEd_digital_transcript_counted_entries_v1_a',
    entryTiming: 'unlockEd_digital_transcript_entry_timing_v1_a'
} as const;

const CATEGORIES_STORAGE_KEYS = {
    draft: 'unlockEd_digital_transcript_draft_v2_categories',
    entries: 'unlockEd_digital_transcript_entries_v2_categories',
    entrySession: 'unlockEd_digital_transcript_entry_session_v1_categories',
    session: 'unlockEd_digital_transcript_session_v1_categories',
    countedEntries: 'unlockEd_digital_transcript_counted_entries_v1_categories',
    entryTiming: 'unlockEd_digital_transcript_entry_timing_v1_categories'
} as const;

/**
 * Who the Learning Record records on this browser belong to.
 *
 * Every `unlockEd_digital_transcript_*` key is scoped to the *origin*, not to the
 * user, and nothing clears them when someone logs out — `handleLogout` resets the
 * analytics identity and the tab session and stops there. On a shared facility
 * workstation that meant the next resident to sign in was offered the previous
 * one's unfinished achievement by name ("pick up where you left off"), which is
 * the opposite of what the privacy notice on that page promises. The analytics
 * records leaked the same way: a sitting left open in `sessionStorage` was
 * *resumed* by the next resident in the same tab, so their `lr_session_ended`
 * carried someone else's entry counts under their own identity.
 *
 * Stamping the owner fixes both, and covers the case clearing-on-logout cannot:
 * a browser closed without logging out at all. It also keeps a returning
 * resident's own draft and dedupe list intact, which clearing on logout would
 * throw away.
 *
 * The stamp is the deployment-namespaced analytics id, never a name or username.
 */
const TRANSCRIPT_STORAGE_OWNER_KEY = 'unlockEd_digital_transcript_owner_v1';

/** Every key both prototypes can write, so a purge cannot miss one. */
function allDigitalTranscriptStorageKeys() {
    return [
        ...Object.values(FUNNEL_STORAGE_KEYS),
        ...Object.values(CATEGORIES_STORAGE_KEYS)
    ];
}

/**
 * Drop every Learning Record record on this browser.
 *
 * Both prototype namespaces are cleared explicitly rather than through
 * `getDigitalTranscriptStorageKeys()`, because that resolves against the *current
 * route* — at sign-in the resident is on `/home`, so it would only ever return the
 * funnel keys and would quietly leave the categories ones behind.
 */
function purgeDigitalTranscriptStorage(): void {
    for (const key of allDigitalTranscriptStorageKeys()) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
            // `session` is the one key held in sessionStorage; removing a missing
            // key is a no-op, so both stores are swept without special-casing.
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(key);
            }
        } catch {
            /* storage unavailable — nothing to purge */
        }
    }
}

/**
 * Record who this browser's Learning Record data belongs to, discarding it first
 * if it belonged to someone else.
 *
 * Call on every successful authentication, not just on a change of user: the
 * check has to survive a full page load, so it cannot rely on anything in memory.
 *
 * **Unrecorded provenance is treated as someone else's.** A browser carrying
 * records but no stamp predates this check, so there is no way to tell whose they
 * are — and inheriting them is the exact bug being fixed. The cost is one-time and
 * bounded: a resident mid-entry when this ships loses only text not yet saved to
 * the server.
 */
export function setDigitalTranscriptStorageOwner(ownerId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
        const previous = localStorage.getItem(TRANSCRIPT_STORAGE_OWNER_KEY);
        if (previous === ownerId) return;
        purgeDigitalTranscriptStorage();
        localStorage.setItem(TRANSCRIPT_STORAGE_OWNER_KEY, ownerId);
    } catch {
        // Quota or private mode. The stamp cannot be written, so the records are
        // purged on every load rather than shared — the safe direction to fail.
    }
}

export function getDigitalTranscriptStorageKeys() {
    const proto = resolveLearningRecordPrototype(
        getActiveDigitalTranscriptStorageBasePath()
    );
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

    const proto = resolveLearningRecordPrototype(
        getActiveDigitalTranscriptStorageBasePath()
    );
    if (proto.storageSuffix !== 'funnel') return;

    const legDraft = localStorage.getItem(
        DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft
    );
    const keys = getDigitalTranscriptStorageKeys();

    if (legDraft) {
        const empty = !localStorage.getItem(keys.draft);
        if (empty) {
            localStorage.setItem(keys.draft, legDraft);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.draft);
        }
    }

    const legEntries = localStorage.getItem(
        DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries
    );
    if (legEntries) {
        const empty =
            !localStorage.getItem(keys.entries) ||
            localStorage.getItem(keys.entries) === '[]';
        if (empty) {
            localStorage.setItem(keys.entries, legEntries);
            localStorage.removeItem(DIGITAL_TRANSCRIPT_LEGACY_STORAGE.entries);
        }
    }
}

export type TranscriptUiPhase = 'survey' | 'preview';

/** Funnel Q4 — standout moment or person toggle. */
export type TranscriptQ4Toggle = 'yes' | 'notReally';

/**
 * Where the achievement took place — often not the resident's current facility.
 * `facilityId` is set when the location is one of this deployment's facilities;
 * `facilityOther` holds free text for anywhere else, and a non-empty value there
 * means the resident chose "Other". The two are mutually exclusive.
 * `facilityName` is a display-only cache, never sent to the API.
 */
export interface TranscriptFacilityFields {
    facilityId: number | null;
    facilityOther: string;
    facilityName: string;
}

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
export interface TranscriptDraft extends TranscriptFacilityFields {
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
export interface TranscriptEntry extends TranscriptFacilityFields {
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
