import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    getDigitalTranscriptStorageKeys,
    migrateDigitalTranscriptLegacyStorage,
    type DigitalTranscriptVariant,
    type TranscriptDraft,
    type TranscriptEntry,
    TRANSCRIPT_STEP_COUNT
} from '@/types/digital-transcript';

function newId() {
    return crypto.randomUUID();
}

export function createEmptyDraft(): TranscriptDraft {
    const now = new Date().toISOString();
    return {
        id: newId(),
        updatedAt: now,
        stepIndex: 0,
        uiPhase: 'survey',
        programName: '',
        completionDate: '',
        confidence: '',
        oneSentence: '',
        skillKnowledge: '',
        goalConnection: '',
        pride: '',
        standoutMoment: '',
        adviceToPeer: ''
    };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function readDraft(variant: DigitalTranscriptVariant): TranscriptDraft | null {
    try {
        const raw = localStorage.getItem(getDigitalTranscriptStorageKeys(variant).draft);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.id !== 'string') return null;
        return parsed as unknown as TranscriptDraft;
    } catch {
        return null;
    }
}

function readEntries(variant: DigitalTranscriptVariant): TranscriptEntry[] {
    try {
        const raw = localStorage.getItem(getDigitalTranscriptStorageKeys(variant).entries);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((e: unknown): e is TranscriptEntry => {
            if (!isRecord(e)) return false;
            return typeof e.id === 'string' && typeof e.programName === 'string';
        });
    } catch {
        return [];
    }
}

function writeDraftToStorage(d: TranscriptDraft, variant: DigitalTranscriptVariant) {
    const next = { ...d, updatedAt: new Date().toISOString() };
    localStorage.setItem(getDigitalTranscriptStorageKeys(variant).draft, JSON.stringify(next));
}

function writeEntriesToStorage(list: TranscriptEntry[], variant: DigitalTranscriptVariant) {
    localStorage.setItem(getDigitalTranscriptStorageKeys(variant).entries, JSON.stringify(list));
}

function removeDraftFromStorage(variant: DigitalTranscriptVariant) {
    localStorage.removeItem(getDigitalTranscriptStorageKeys(variant).draft);
}

const AUTOSAVE_MS = 400;

export interface UseTranscriptDraftOptions {
    variant: DigitalTranscriptVariant;
}

export function useTranscriptDraft({ variant }: UseTranscriptDraftOptions) {
    const [draft, setDraft] = useState<TranscriptDraft | null>(null);
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const skipPersistRef = useRef(true);
    const draftRef = useRef<TranscriptDraft | null>(null);
    draftRef.current = draft;

    useEffect(() => {
        migrateDigitalTranscriptLegacyStorage();
        setDraft(readDraft(variant));
        setEntries(readEntries(variant));
        setHydrated(true);
        skipPersistRef.current = true;
    }, [variant]);

    useEffect(() => {
        if (!hydrated) return;
        if (skipPersistRef.current) {
            skipPersistRef.current = false;
            return;
        }
        const t = window.setTimeout(() => {
            if (draft) writeDraftToStorage(draft, variant);
            else removeDraftFromStorage(variant);
        }, AUTOSAVE_MS);
        return () => window.clearTimeout(t);
    }, [draft, hydrated, variant]);

    const updateDraft = useCallback((patch: Partial<TranscriptDraft>) => {
        setDraft((prev) => {
            const base = prev ?? createEmptyDraft();
            return { ...base, ...patch, updatedAt: new Date().toISOString() };
        });
    }, []);

    const ensureDraft = useCallback(() => {
        const existing = readDraft(variant);
        if (existing) {
            setDraft(existing);
            skipPersistRef.current = true;
            return existing;
        }
        const fresh = createEmptyDraft();
        writeDraftToStorage(fresh, variant);
        setDraft(fresh);
        skipPersistRef.current = true;
        return fresh;
    }, [variant]);

    const startFreshDraft = useCallback(() => {
        removeDraftFromStorage(variant);
        const fresh = createEmptyDraft();
        writeDraftToStorage(fresh, variant);
        setDraft(fresh);
        skipPersistRef.current = true;
        return fresh;
    }, [variant]);

    const goToPreview = useCallback(() => {
        setDraft((prev) => {
            const base = prev ?? createEmptyDraft();
            return { ...base, uiPhase: 'preview', updatedAt: new Date().toISOString() };
        });
    }, []);

    const goToSurveyFromPreview = useCallback(() => {
        setDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                uiPhase: 'survey',
                stepIndex: TRANSCRIPT_STEP_COUNT - 1,
                updatedAt: new Date().toISOString()
            };
        });
    }, []);

    const persistDraftNow = useCallback(() => {
        const d = draftRef.current;
        if (d) writeDraftToStorage(d, variant);
    }, [variant]);

    const completeEntry = useCallback(
        (source: TranscriptDraft) => {
            const entry: TranscriptEntry = {
                id: newId(),
                createdAt: new Date().toISOString(),
                programName: source.programName,
                completionDate: source.completionDate,
                confidence: source.confidence,
                oneSentence: source.oneSentence,
                skillKnowledge: source.skillKnowledge,
                goalConnection: source.goalConnection,
                pride: source.pride,
                standoutMoment: source.standoutMoment,
                adviceToPeer: source.adviceToPeer
            };
            const list = [...readEntries(variant), entry];
            writeEntriesToStorage(list, variant);
            setEntries(list);
            removeDraftFromStorage(variant);
            setDraft(null);
            skipPersistRef.current = true;
        },
        [variant]
    );

    const reloadEntries = useCallback(() => {
        setEntries(readEntries(variant));
    }, [variant]);

    const hasDraft = useMemo(() => Boolean(draft), [draft]);

    return {
        draft,
        entries,
        hydrated,
        hasDraft,
        updateDraft,
        ensureDraft,
        startFreshDraft,
        goToPreview,
        goToSurveyFromPreview,
        completeEntry,
        reloadEntries,
        persistDraftNow
    };
}
