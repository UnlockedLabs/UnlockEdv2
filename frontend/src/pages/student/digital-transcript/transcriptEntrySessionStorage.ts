import { TOP_SKILLS_MAX } from '@/pages/student/digital-transcript/transcriptReflectionConfig';
import {
    getDigitalTranscriptStorageKeys,
    TRANSCRIPT_ENTRY_SESSION_VERSION,
    type TranscriptDraft,
    type TranscriptEntry,
    type TranscriptEntrySession,
    type TranscriptQ4Toggle
} from '@/types/digital-transcript';

function newId() {
    return crypto.randomUUID();
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function strField(v: unknown): string {
    return typeof v === 'string' ? v : '';
}

function normalizeTopSkills(parsed: Record<string, unknown>): string[] {
    const raw = parsed.topSkills;
    if (Array.isArray(raw)) {
        return raw
            .filter((x): x is string => typeof x === 'string')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, TOP_SKILLS_MAX);
    }
    const legacy = parsed.skillKnowledge;
    if (typeof legacy === 'string' && legacy.trim()) {
        return [legacy.trim()].slice(0, TOP_SKILLS_MAX);
    }
    return [];
}

const Q5_TAGS_MAX = 2;

function normalizeStringArray(raw: unknown, max: number): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max);
}

function normalizeQ4Toggle(raw: unknown): TranscriptQ4Toggle | null {
    if (raw === 'yes' || raw === 'notReally') return raw;
    return null;
}

function emptyFunnelReflectionFields(): Pick<
    TranscriptEntry,
    | 'q4Toggle'
    | 'q4Text'
    | 'q5BeforeTags'
    | 'q5AfterTags'
    | 'q5FreeText'
    | 'q7Text'
    | 'q8Selections'
    | 'q9Selections'
> {
    return {
        q4Toggle: null,
        q4Text: '',
        q5BeforeTags: [],
        q5AfterTags: [],
        q5FreeText: '',
        q7Text: '',
        q8Selections: [],
        q9Selections: []
    };
}

function migrateLegacyFunnelFields(
    parsed: Record<string, unknown>,
    base: ReturnType<typeof emptyFunnelReflectionFields>
): ReturnType<typeof emptyFunnelReflectionFields> {
    const standoutMoment = strField(parsed.standoutMoment);
    const pride = strField(parsed.pride);

    let q4Toggle = base.q4Toggle;
    let q4Text = base.q4Text;
    if (!q4Toggle && !q4Text.trim() && standoutMoment.trim()) {
        q4Toggle = 'yes';
        q4Text = standoutMoment.trim();
    }

    let q5FreeText = base.q5FreeText;
    if (!q5FreeText.trim() && pride.trim()) {
        q5FreeText = pride.trim();
    }

    return { ...base, q4Toggle, q4Text, q5FreeText };
}

export function normalizeTranscriptEntry(parsed: Record<string, unknown>): TranscriptEntry {
    const e = parsed as Partial<TranscriptEntry>;
    const funnelBase = migrateLegacyFunnelFields(parsed, {
        q4Toggle: normalizeQ4Toggle(e.q4Toggle),
        q4Text: strField(e.q4Text),
        q5BeforeTags: normalizeStringArray(e.q5BeforeTags, Q5_TAGS_MAX),
        q5AfterTags: normalizeStringArray(e.q5AfterTags, Q5_TAGS_MAX),
        q5FreeText: strField(e.q5FreeText),
        q7Text: strField(e.q7Text),
        q8Selections: normalizeStringArray(e.q8Selections, 20),
        q9Selections: normalizeStringArray(e.q9Selections, 20)
    });

    return {
        id: strField(e.id) || newId(),
        createdAt: strField(e.createdAt) || new Date().toISOString(),
        programName: strField(e.programName),
        completionDate: strField(e.completionDate),
        confidence: strField(e.confidence),
        oneSentence: strField(e.oneSentence),
        topSkills: normalizeTopSkills(parsed),
        whatMadeYouFinish: strField(e.whatMadeYouFinish),
        goalConnection: strField(e.goalConnection),
        pride: strField(e.pride),
        standoutMoment: strField(e.standoutMoment),
        adviceToPeer: strField(e.adviceToPeer),
        ...funnelBase
    };
}

export function createEmptyTranscriptEntry(): TranscriptEntry {
    const now = new Date().toISOString();
    return {
        id: newId(),
        createdAt: now,
        programName: '',
        completionDate: '',
        confidence: '',
        oneSentence: '',
        topSkills: [],
        whatMadeYouFinish: '',
        goalConnection: '',
        pride: '',
        standoutMoment: '',
        adviceToPeer: '',
        ...emptyFunnelReflectionFields()
    };
}

export function cloneTranscriptEntry(e: TranscriptEntry): TranscriptEntry {
    return {
        ...e,
        topSkills: [...e.topSkills],
        q5BeforeTags: [...e.q5BeforeTags],
        q5AfterTags: [...e.q5AfterTags],
        q8Selections: [...e.q8Selections],
        q9Selections: [...e.q9Selections]
    };
}

export function sortEntriesChronological(list: TranscriptEntry[]): TranscriptEntry[] {
    return [...list].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export function sortEntriesNewestFirst(list: TranscriptEntry[]): TranscriptEntry[] {
    return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/** True when any reflection or metadata field has been filled (autosaved work counts). */
export function entryHasExportableContent(entry: TranscriptEntry): boolean {
    return (
        Boolean(entry.programName.trim()) ||
        Boolean(entry.completionDate.trim()) ||
        Boolean(entry.confidence.trim()) ||
        Boolean(entry.topSkills.length) ||
        Boolean(entry.whatMadeYouFinish.trim()) ||
        Boolean(entry.goalConnection.trim()) ||
        Boolean(entry.pride.trim()) ||
        Boolean(entry.standoutMoment.trim()) ||
        Boolean(entry.adviceToPeer.trim()) ||
        Boolean(entry.oneSentence.trim()) ||
        entry.q4Toggle !== null ||
        Boolean(entry.q4Text.trim()) ||
        entry.q5BeforeTags.length > 0 ||
        entry.q5AfterTags.length > 0 ||
        Boolean(entry.q5FreeText.trim()) ||
        Boolean(entry.q7Text.trim()) ||
        entry.q8Selections.length > 0 ||
        entry.q9Selections.length > 0
    );
}

/** Rows to include in PDF export and similar “current work” views. */
export function filterEntriesForExport(rows: TranscriptEntry[]): TranscriptEntry[] {
    return sortEntriesNewestFirst(rows.filter(entryHasExportableContent));
}

/** Latest autosaved session rows with content; falls back to committed entries. */
export function readLearningRecordExportRows(): TranscriptEntry[] {
    const session = readEntrySessionFromStorage();
    if (session?.rows.length) {
        return filterEntriesForExport(session.rows);
    }
    return filterEntriesForExport(readTranscriptEntriesFromStorage());
}

function normalizeTranscriptDraft(parsed: Record<string, unknown>): TranscriptDraft {
    const d = parsed as Partial<TranscriptDraft>;
    const emptyId = newId();
    const now = new Date().toISOString();
    return {
        id: strField(d.id) || emptyId,
        updatedAt: strField(d.updatedAt) || now,
        stepIndex: typeof d.stepIndex === 'number' ? d.stepIndex : 0,
        uiPhase: d.uiPhase === 'preview' || d.uiPhase === 'survey' ? d.uiPhase : 'survey',
        programName: strField(d.programName),
        completionDate: strField(d.completionDate),
        confidence: strField(d.confidence),
        oneSentence: strField(d.oneSentence),
        topSkills: normalizeTopSkills(parsed),
        whatMadeYouFinish: strField(d.whatMadeYouFinish),
        goalConnection: strField(d.goalConnection),
        pride: strField(d.pride),
        standoutMoment: strField(d.standoutMoment),
        adviceToPeer: strField(d.adviceToPeer),
        ...migrateLegacyFunnelFields(parsed, {
            q4Toggle: normalizeQ4Toggle(d.q4Toggle),
            q4Text: strField(d.q4Text),
            q5BeforeTags: normalizeStringArray(d.q5BeforeTags, Q5_TAGS_MAX),
            q5AfterTags: normalizeStringArray(d.q5AfterTags, Q5_TAGS_MAX),
            q5FreeText: strField(d.q5FreeText),
            q7Text: strField(d.q7Text),
            q8Selections: normalizeStringArray(d.q8Selections, 20),
            q9Selections: normalizeStringArray(d.q9Selections, 20)
        }),
        editingEntryId:
            typeof d.editingEntryId === 'string' && d.editingEntryId.trim()
                ? d.editingEntryId.trim()
                : undefined
    };
}

function readDraftRaw(): TranscriptDraft | null {
    try {
        const raw = localStorage.getItem(getDigitalTranscriptStorageKeys().draft);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.id !== 'string') return null;
        return normalizeTranscriptDraft(parsed);
    } catch {
        return null;
    }
}

export function readTranscriptEntriesFromStorage(): TranscriptEntry[] {
    try {
        const raw = localStorage.getItem(getDigitalTranscriptStorageKeys().entries);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((e: unknown): e is Record<string, unknown> => isRecord(e))
            .filter((e) => typeof e.id === 'string' && typeof e.programName === 'string')
            .map((e) => normalizeTranscriptEntry(e));
    } catch {
        return [];
    }
}

export function writeTranscriptEntriesToStorage(list: TranscriptEntry[]) {
    localStorage.setItem(getDigitalTranscriptStorageKeys().entries, JSON.stringify(list));
}

function stringArraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((s, i) => s === b[i]);
}

export function entryPayloadEqual(a: TranscriptEntry, b: TranscriptEntry): boolean {
    return (
        a.programName === b.programName &&
        a.completionDate === b.completionDate &&
        a.confidence === b.confidence &&
        a.oneSentence === b.oneSentence &&
        a.whatMadeYouFinish === b.whatMadeYouFinish &&
        a.goalConnection === b.goalConnection &&
        a.pride === b.pride &&
        a.standoutMoment === b.standoutMoment &&
        a.adviceToPeer === b.adviceToPeer &&
        a.q4Toggle === b.q4Toggle &&
        a.q4Text === b.q4Text &&
        a.q5FreeText === b.q5FreeText &&
        a.q7Text === b.q7Text &&
        stringArraysEqual(a.topSkills, b.topSkills) &&
        stringArraysEqual(a.q5BeforeTags, b.q5BeforeTags) &&
        stringArraysEqual(a.q5AfterTags, b.q5AfterTags) &&
        stringArraysEqual(a.q8Selections, b.q8Selections) &&
        stringArraysEqual(a.q9Selections, b.q9Selections)
    );
}

/** True if session rows differ from committed entries (unsaved work on entry page). */
export function entrySessionIsDirty(
    session: TranscriptEntrySession | null,
    committed: TranscriptEntry[]
): boolean {
    if (!session) return false;
    const byId = new Map(committed.map((e) => [e.id, e]));
    if (session.rows.length !== committed.length) return true;
    for (const row of session.rows) {
        const c = byId.get(row.id);
        if (!c) return true;
        if (!entryPayloadEqual(row, c)) return true;
    }
    return false;
}

function normalizeEntrySession(parsed: Record<string, unknown>): TranscriptEntrySession | null {
    if (parsed.version !== TRANSCRIPT_ENTRY_SESSION_VERSION) return null;
    const rowsRaw = parsed.rows;
    if (!Array.isArray(rowsRaw)) return null;
    const rows = rowsRaw
        .filter((e: unknown): e is Record<string, unknown> => isRecord(e))
        .filter((e) => typeof e.id === 'string')
        .map((e) => normalizeTranscriptEntry(e));
    const expandedId =
        typeof parsed.expandedId === 'string' && parsed.expandedId.trim()
            ? parsed.expandedId.trim()
            : null;
    const lastPreviewId =
        typeof parsed.lastPreviewId === 'string' && parsed.lastPreviewId.trim()
            ? parsed.lastPreviewId.trim()
            : null;
    return {
        version: TRANSCRIPT_ENTRY_SESSION_VERSION,
        rows,
        expandedId,
        lastPreviewId
    };
}

export function readEntrySessionFromStorage(): TranscriptEntrySession | null {
    try {
        const raw = localStorage.getItem(getDigitalTranscriptStorageKeys().entrySession);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return null;
        return normalizeEntrySession(parsed);
    } catch {
        return null;
    }
}

export function writeEntrySessionToStorage(session: TranscriptEntrySession) {
    localStorage.setItem(getDigitalTranscriptStorageKeys().entrySession, JSON.stringify(session));
}

export function removeEntrySessionFromStorage() {
    localStorage.removeItem(getDigitalTranscriptStorageKeys().entrySession);
}

export function dispatchEntrySessionUpdated() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('transcript-entry-session-updated'));
}

function draftHasContent(d: TranscriptDraft): boolean {
    return (
        Boolean(d.programName.trim()) ||
        Boolean(d.completionDate.trim()) ||
        Boolean(d.confidence.trim()) ||
        Boolean(d.topSkills.length) ||
        Boolean(d.whatMadeYouFinish.trim()) ||
        Boolean(d.goalConnection.trim()) ||
        Boolean(d.pride.trim()) ||
        Boolean(d.standoutMoment.trim()) ||
        Boolean(d.adviceToPeer.trim()) ||
        Boolean(d.oneSentence.trim()) ||
        d.q4Toggle !== null ||
        Boolean(d.q4Text.trim()) ||
        d.q5BeforeTags.length > 0 ||
        d.q5AfterTags.length > 0 ||
        Boolean(d.q5FreeText.trim()) ||
        Boolean(d.q7Text.trim()) ||
        d.q8Selections.length > 0 ||
        d.q9Selections.length > 0
    );
}

function entryFromDraft(d: TranscriptDraft, committed: TranscriptEntry[]): TranscriptEntry {
    const base = {
        programName: d.programName,
        completionDate: d.completionDate,
        confidence: d.confidence,
        oneSentence: d.oneSentence,
        topSkills: [...d.topSkills].slice(0, TOP_SKILLS_MAX),
        whatMadeYouFinish: d.whatMadeYouFinish,
        goalConnection: d.goalConnection,
        pride: d.pride,
        standoutMoment: d.standoutMoment,
        adviceToPeer: d.adviceToPeer,
        q4Toggle: d.q4Toggle,
        q4Text: d.q4Text,
        q5BeforeTags: [...d.q5BeforeTags],
        q5AfterTags: [...d.q5AfterTags],
        q5FreeText: d.q5FreeText,
        q7Text: d.q7Text,
        q8Selections: [...d.q8Selections],
        q9Selections: [...d.q9Selections]
    };
    if (d.editingEntryId) {
        const prev = committed.find((e) => e.id === d.editingEntryId);
        return {
            id: d.editingEntryId,
            createdAt: prev?.createdAt ?? new Date().toISOString(),
            ...base
        };
    }
    return {
        id: newId(),
        createdAt: new Date().toISOString(),
        ...base
    };
}

/**
 * Prefer disk session; else build from committed entries; else migrate legacy single draft into one row.
 * Removes legacy draft after successful migration into session.
 */
export function resolveInitialEntrySession(): TranscriptEntrySession {
    const committed = sortEntriesChronological(readTranscriptEntriesFromStorage());
    const existing = readEntrySessionFromStorage();
    if (existing?.version === TRANSCRIPT_ENTRY_SESSION_VERSION && Array.isArray(existing.rows)) {
        return existing;
    }
    const draft = readDraftRaw();
    if (draft && draftHasContent(draft)) {
        const row = entryFromDraft(draft, committed);
        let rows: TranscriptEntry[];
        if (draft.editingEntryId) {
            rows = committed.map((e) => (e.id === draft.editingEntryId ? row : e));
            if (!committed.some((e) => e.id === draft.editingEntryId)) {
                rows = sortEntriesChronological([...committed, row]);
            }
        } else {
            rows = sortEntriesChronological([...committed, row]);
        }
        const session: TranscriptEntrySession = {
            version: TRANSCRIPT_ENTRY_SESSION_VERSION,
            rows,
            expandedId: row.id,
            lastPreviewId: row.id
        };
        writeEntrySessionToStorage(session);
        localStorage.removeItem(getDigitalTranscriptStorageKeys().draft);
        dispatchEntrySessionUpdated();
        return session;
    }
    const lastId = committed[committed.length - 1]?.id ?? null;
    return {
        version: TRANSCRIPT_ENTRY_SESSION_VERSION,
        rows: committed.map(cloneTranscriptEntry),
        expandedId: null,
        lastPreviewId: lastId
    };
}

export function syncSessionRowsAfterUpsert(
    session: TranscriptEntrySession,
    saved: TranscriptEntry
): TranscriptEntrySession {
    const idx = session.rows.findIndex((r) => r.id === saved.id);
    const nextRow = cloneTranscriptEntry(saved);
    let rows: TranscriptEntry[];
    if (idx >= 0) {
        rows = [...session.rows];
        rows[idx] = nextRow;
    } else {
        rows = sortEntriesChronological([...session.rows, nextRow]);
    }
    return {
        ...session,
        rows,
        lastPreviewId: saved.id
    };
}

/**
 * Remove a committed achievement from `entries` and prune it from the entry editor session.
 * Returns the updated session when one remains on disk, or null if the session blob was cleared.
 */
export function deleteTranscriptEntryById(id: string): TranscriptEntrySession | null {
    const trimmed = id.trim();
    if (!trimmed) {
        return readEntrySessionFromStorage();
    }

    const nextEntries = readTranscriptEntriesFromStorage().filter((e) => e.id !== trimmed);
    writeTranscriptEntriesToStorage(nextEntries);

    const session = readEntrySessionFromStorage();
    if (!session) {
        dispatchEntrySessionUpdated();
        return null;
    }

    const rows = session.rows.filter((r) => r.id !== trimmed);
    let expandedId = session.expandedId === trimmed ? null : session.expandedId;
    let lastPreviewId = session.lastPreviewId;
    if (lastPreviewId === trimmed) {
        lastPreviewId = rows.length > 0 ? rows[rows.length - 1].id : null;
    }
    if (expandedId && !rows.some((r) => r.id === expandedId)) {
        expandedId = null;
    }

    if (rows.length === 0) {
        removeEntrySessionFromStorage();
        dispatchEntrySessionUpdated();
        return null;
    }

    const next: TranscriptEntrySession = {
        version: TRANSCRIPT_ENTRY_SESSION_VERSION,
        rows,
        expandedId,
        lastPreviewId
    };
    writeEntrySessionToStorage(next);
    dispatchEntrySessionUpdated();
    return next;
}
