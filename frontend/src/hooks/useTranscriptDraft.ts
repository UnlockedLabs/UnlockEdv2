import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOP_SKILLS_MAX } from '@/pages/student/digital-transcript/transcriptReflectionConfig';
import {
    createEmptyTranscriptEntry,
    deleteTranscriptEntryById,
    dispatchEntrySessionUpdated,
    entrySessionIsDirty,
    readEntrySessionFromStorage,
    readTranscriptEntriesFromStorage,
    writeTranscriptEntriesToStorage
} from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import {
    getDigitalTranscriptStorageKeys,
    migrateDigitalTranscriptLegacyStorage,
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

/** Normalize tags from persisted JSON; migrate legacy `skillKnowledge` string to a single tag. */
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

/** Merge persisted JSON with current defaults so new keys never read as undefined. */
function normalizeTranscriptDraft(parsed: Record<string, unknown>): TranscriptDraft {
    const d = parsed as Partial<TranscriptDraft>;
    const empty = createEmptyDraft();
    return {
        id: strField(d.id) || empty.id,
        updatedAt: strField(d.updatedAt) || empty.updatedAt,
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
        q4Toggle:
            d.q4Toggle === 'yes' || d.q4Toggle === 'notReally' ? d.q4Toggle : null,
        q4Text: strField(d.q4Text),
        q5BeforeTags: Array.isArray(d.q5BeforeTags)
            ? d.q5BeforeTags.filter((x): x is string => typeof x === 'string').slice(0, 2)
            : [],
        q5AfterTags: Array.isArray(d.q5AfterTags)
            ? d.q5AfterTags.filter((x): x is string => typeof x === 'string').slice(0, 2)
            : [],
        q5FreeText: strField(d.q5FreeText),
        q7Text: strField(d.q7Text),
        q8Selections: Array.isArray(d.q8Selections)
            ? d.q8Selections.filter((x): x is string => typeof x === 'string')
            : [],
        q9Selections: Array.isArray(d.q9Selections)
            ? d.q9Selections.filter((x): x is string => typeof x === 'string')
            : [],
        editingEntryId:
            typeof d.editingEntryId === 'string' && d.editingEntryId.trim()
                ? d.editingEntryId.trim()
                : undefined
    };
}

export function createEmptyDraft(): TranscriptDraft {
    const empty = createEmptyTranscriptEntry();
    const now = new Date().toISOString();
    return {
        id: newId(),
        updatedAt: now,
        stepIndex: 0,
        uiPhase: 'survey',
        programName: empty.programName,
        completionDate: empty.completionDate,
        confidence: empty.confidence,
        oneSentence: empty.oneSentence,
        topSkills: empty.topSkills,
        whatMadeYouFinish: empty.whatMadeYouFinish,
        goalConnection: empty.goalConnection,
        pride: empty.pride,
        standoutMoment: empty.standoutMoment,
        adviceToPeer: empty.adviceToPeer,
        q4Toggle: empty.q4Toggle,
        q4Text: empty.q4Text,
        q5BeforeTags: empty.q5BeforeTags,
        q5AfterTags: empty.q5AfterTags,
        q5FreeText: empty.q5FreeText,
        q7Text: empty.q7Text,
        q8Selections: empty.q8Selections,
        q9Selections: empty.q9Selections,
        editingEntryId: undefined
    };
}

function readDraft(): TranscriptDraft | null {
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

function readEntries(): TranscriptEntry[] {
    return readTranscriptEntriesFromStorage();
}

function writeDraftToStorage(d: TranscriptDraft) {
    const next = { ...d, updatedAt: new Date().toISOString() };
    localStorage.setItem(getDigitalTranscriptStorageKeys().draft, JSON.stringify(next));
}

function writeEntriesToStorage(list: TranscriptEntry[]) {
    writeTranscriptEntriesToStorage(list);
}

function removeDraftFromStorage() {
    localStorage.removeItem(getDigitalTranscriptStorageKeys().draft);
}

const AUTOSAVE_MS = 400;

const ENTRY_SESSION_EVENT = 'transcript-entry-session-updated';

export function useTranscriptDraft() {
    const [draft, setDraft] = useState<TranscriptDraft | null>(null);
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [entrySessionEpoch, setEntrySessionEpoch] = useState(0);
    const skipPersistRef = useRef(true);
    const draftRef = useRef<TranscriptDraft | null>(null);
    draftRef.current = draft;

    useEffect(() => {
        migrateDigitalTranscriptLegacyStorage();
        setDraft(readDraft());
        setEntries(readEntries());
        setHydrated(true);
        skipPersistRef.current = true;
    }, []);

    useEffect(() => {
        const bump = () => setEntrySessionEpoch((n) => n + 1);
        window.addEventListener(ENTRY_SESSION_EVENT, bump);
        return () => window.removeEventListener(ENTRY_SESSION_EVENT, bump);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (skipPersistRef.current) {
            skipPersistRef.current = false;
            return;
        }
        const t = window.setTimeout(() => {
            if (draft) writeDraftToStorage(draft);
            else removeDraftFromStorage();
        }, AUTOSAVE_MS);
        return () => window.clearTimeout(t);
    }, [draft, hydrated]);

    const updateDraft = useCallback((patch: Partial<TranscriptDraft>) => {
        setDraft((prev) => {
            const base = prev ?? createEmptyDraft();
            return { ...base, ...patch, updatedAt: new Date().toISOString() };
        });
    }, []);

    const ensureDraft = useCallback(() => {
        const existing = readDraft();
        if (existing) {
            setDraft(existing);
            skipPersistRef.current = true;
            return existing;
        }
        const fresh = createEmptyDraft();
        writeDraftToStorage(fresh);
        setDraft(fresh);
        skipPersistRef.current = true;
        return fresh;
    }, []);

    const startFreshDraft = useCallback(() => {
        removeDraftFromStorage();
        const fresh = createEmptyDraft();
        writeDraftToStorage(fresh);
        setDraft(fresh);
        skipPersistRef.current = true;
        return fresh;
    }, []);

    /** Load a saved achievement into the editor; overwrites any current draft. */
    const loadEntryForEdit = useCallback((entryId: string) => {
        const list = readEntries();
        const entry = list.find((e) => e.id === entryId);
        if (!entry) return false;
        const nextDraft: TranscriptDraft = {
            id: newId(),
            updatedAt: new Date().toISOString(),
            stepIndex: 0,
            uiPhase: 'survey',
            programName: entry.programName,
            completionDate: entry.completionDate,
            confidence: entry.confidence,
            oneSentence: entry.oneSentence,
            topSkills: [...entry.topSkills],
            whatMadeYouFinish: entry.whatMadeYouFinish,
            goalConnection: entry.goalConnection,
            pride: entry.pride,
            standoutMoment: entry.standoutMoment,
            adviceToPeer: entry.adviceToPeer,
            editingEntryId: entry.id
        };
        writeDraftToStorage(nextDraft);
        setDraft(nextDraft);
        skipPersistRef.current = true;
        return true;
    }, []);

    const persistDraftNow = useCallback(() => {
        const d = draftRef.current;
        if (d) writeDraftToStorage(d);
    }, []);

    const completeEntry = useCallback((source: TranscriptDraft) => {
        const payload = {
            programName: source.programName,
            completionDate: source.completionDate,
            confidence: source.confidence,
            oneSentence: source.oneSentence,
            topSkills: source.topSkills.slice(0, TOP_SKILLS_MAX),
            whatMadeYouFinish: source.whatMadeYouFinish,
            goalConnection: source.goalConnection,
            pride: source.pride,
            standoutMoment: source.standoutMoment,
            adviceToPeer: source.adviceToPeer,
            q4Toggle: source.q4Toggle,
            q4Text: source.q4Text,
            q5BeforeTags: source.q5BeforeTags.slice(0, 2),
            q5AfterTags: source.q5AfterTags.slice(0, 2),
            q5FreeText: source.q5FreeText,
            q7Text: source.q7Text,
            q8Selections: [...source.q8Selections],
            q9Selections: [...source.q9Selections]
        };

        let list: TranscriptEntry[];
        if (source.editingEntryId) {
            const existing = readEntries();
            const idx = existing.findIndex((e) => e.id === source.editingEntryId);
            if (idx >= 0) {
                const prev = existing[idx];
                const updated: TranscriptEntry = {
                    ...prev,
                    ...payload
                };
                list = [...existing];
                list[idx] = updated;
            } else {
                const entry: TranscriptEntry = {
                    id: newId(),
                    createdAt: new Date().toISOString(),
                    ...payload
                };
                list = [...existing, entry];
            }
        } else {
            const entry: TranscriptEntry = {
                id: newId(),
                createdAt: new Date().toISOString(),
                ...payload
            };
            list = [...readEntries(), entry];
        }
        writeEntriesToStorage(list);
        setEntries(list);
        removeDraftFromStorage();
        setDraft(null);
        skipPersistRef.current = true;
        dispatchEntrySessionUpdated();
    }, []);

    /** Upsert one achievement into committed storage (entry page multi-row Done). */
    const upsertCommittedEntry = useCallback((entry: TranscriptEntry) => {
        const existing = readEntries();
        const idx = existing.findIndex((e) => e.id === entry.id);
        let list: TranscriptEntry[];
        if (idx >= 0) {
            list = [...existing];
            list[idx] = entry;
        } else {
            list = [...existing, entry];
        }
        writeEntriesToStorage(list);
        setEntries(list);
        dispatchEntrySessionUpdated();
    }, []);

    /** Remove a saved achievement from device storage and entry session. */
    const deleteCommittedEntry = useCallback((id: string): TranscriptEntrySession | null => {
        const nextSession = deleteTranscriptEntryById(id);
        setEntries(readTranscriptEntriesFromStorage());
        skipPersistRef.current = true;
        return nextSession;
    }, []);

    const reloadEntries = useCallback(() => {
        setEntries(readEntries());
    }, []);

    const hasDraft = useMemo(() => {
        void entrySessionEpoch;
        if (draft) return true;
        return entrySessionIsDirty(readEntrySessionFromStorage(), readTranscriptEntriesFromStorage());
    }, [draft, entrySessionEpoch]);

    return {
        draft,
        entries,
        hydrated,
        hasDraft,
        updateDraft,
        ensureDraft,
        startFreshDraft,
        completeEntry,
        upsertCommittedEntry,
        deleteCommittedEntry,
        reloadEntries,
        persistDraftNow,
        loadEntryForEdit
    };
}
