import { TOP_SKILLS_MAX } from '@/pages/student/digital-transcript/transcriptReflectionConfig';
import { entryIsComplete } from '@/pages/student/digital-transcript/learningRecordDocumentModel';
import type { LearningRecordFormVariant } from '@/pages/student/digital-transcript/learningRecordPrototypes';
import {
    getDigitalTranscriptStorageKeys,
    TRANSCRIPT_ENTRY_SESSION_VERSION,
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

export function normalizeTranscriptEntry(
    parsed: Record<string, unknown>
): TranscriptEntry {
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

export function sortEntriesChronological(
    list: TranscriptEntry[]
): TranscriptEntry[] {
    return [...list].sort(
        (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export function sortEntriesNewestFirst(
    list: TranscriptEntry[]
): TranscriptEntry[] {
    return [...list].sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

/**
 * Most recent achievement with answers in progress but not all questions complete.
 * Checks live session rows first, then committed entries.
 */
export function findIncompleteAchievementEntry(
    committedEntries: TranscriptEntry[],
    variant: LearningRecordFormVariant = 'categories'
): TranscriptEntry | null {
    const committed = committedEntries;
    const session = readEntrySessionFromStorage();
    const seen = new Set<string>();
    const incomplete: TranscriptEntry[] = [];

    if (session?.rows.length) {
        for (const row of session.rows) {
            if (
                entryHasExportableContent(row) &&
                !entryIsComplete(row, variant)
            ) {
                incomplete.push(row);
                seen.add(row.id);
            }
        }
    }

    for (const entry of committed) {
        if (seen.has(entry.id)) continue;
        if (
            entryHasExportableContent(entry) &&
            !entryIsComplete(entry, variant)
        ) {
            incomplete.push(entry);
        }
    }

    return incomplete.length > 0 ? sortEntriesNewestFirst(incomplete)[0] : null;
}

/** Rows to include in PDF export and similar “current work” views. */
export function filterEntriesForExport(
    rows: TranscriptEntry[]
): TranscriptEntry[] {
    return sortEntriesNewestFirst(rows.filter(entryHasExportableContent));
}

/** Session rows with exportable content, or fall back to committed entries. */
export function readLearningRecordExportRows(
    committedEntries: TranscriptEntry[]
): TranscriptEntry[] {
    const session = readEntrySessionFromStorage();
    if (session?.rows.length) {
        return filterEntriesForExport(session.rows);
    }
    return filterEntriesForExport(committedEntries);
}

function stringArraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((s, i) => s === b[i]);
}

export function entryPayloadEqual(
    a: TranscriptEntry,
    b: TranscriptEntry
): boolean {
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

function normalizeEntrySession(
    parsed: Record<string, unknown>
): TranscriptEntrySession | null {
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
        const raw = localStorage.getItem(
            getDigitalTranscriptStorageKeys().entrySession
        );
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return null;
        return normalizeEntrySession(parsed);
    } catch {
        return null;
    }
}

export function writeEntrySessionToStorage(session: TranscriptEntrySession) {
    localStorage.setItem(
        getDigitalTranscriptStorageKeys().entrySession,
        JSON.stringify(session)
    );
}

export function removeEntrySessionFromStorage() {
    localStorage.removeItem(getDigitalTranscriptStorageKeys().entrySession);
}

export function dispatchEntrySessionUpdated() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('transcript-entry-session-updated'));
}

/**
 * Build initial entry session from committed entries (API-sourced).
 * Falls back to a saved UI session if available.
 */
export function resolveInitialEntrySession(
    committed: TranscriptEntry[]
): TranscriptEntrySession {
    const sorted = sortEntriesChronological(committed);
    const existing = readEntrySessionFromStorage();
    if (
        existing?.version === TRANSCRIPT_ENTRY_SESSION_VERSION &&
        Array.isArray(existing.rows)
    ) {
        // Merge: update any rows whose committed counterpart changed
        const byId = new Map(sorted.map((e) => [e.id, e]));
        const rows = existing.rows
            .filter((r) => byId.has(r.id) || !sorted.some((e) => e.id === r.id))
            .map((r) => {
                const committed = byId.get(r.id);
                return committed ? cloneTranscriptEntry(committed) : r;
            });
        // Add any committed entries not yet in the session
        for (const e of sorted) {
            if (!rows.some((r) => r.id === e.id)) {
                rows.push(cloneTranscriptEntry(e));
            }
        }
        return { ...existing, rows: sortEntriesChronological(rows) };
    }
    const lastId = sorted[sorted.length - 1]?.id ?? null;
    return {
        version: TRANSCRIPT_ENTRY_SESSION_VERSION,
        rows: sorted.map(cloneTranscriptEntry),
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
