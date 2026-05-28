import { TOP_SKILLS_MAX } from '@/pages/student/digital-transcript/transcriptReflectionConfig';
import {
    getDigitalTranscriptStorageKeys,
    TRANSCRIPT_ENTRY_SESSION_VERSION,
    type TranscriptDraft,
    type TranscriptEntry,
    type TranscriptEntrySession
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

export function normalizeTranscriptEntry(parsed: Record<string, unknown>): TranscriptEntry {
    const e = parsed as Partial<TranscriptEntry>;
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
        adviceToPeer: strField(e.adviceToPeer)
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
        adviceToPeer: ''
    };
}

export function cloneTranscriptEntry(e: TranscriptEntry): TranscriptEntry {
    return {
        ...e,
        topSkills: [...e.topSkills]
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
        Boolean(entry.oneSentence.trim())
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
        a.topSkills.length === b.topSkills.length &&
        a.topSkills.every((s, i) => s === b.topSkills[i])
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
        Boolean(d.oneSentence.trim())
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
        adviceToPeer: d.adviceToPeer
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
