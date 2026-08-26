import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    apiCreateEntry,
    apiDeleteDraft,
    apiDeleteEntry,
    apiGetDraft,
    apiGetEntries,
    apiUpdateEntry,
    apiUpsertDraft
} from '@/api/learningRecord';
import { TOP_SKILLS_MAX } from '@/pages/student/digital-transcript/transcriptReflectionConfig';
import { dispatchEntrySessionUpdated } from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import type {
    TranscriptDraft,
    TranscriptEntry
} from '@/types/digital-transcript';

export function createEmptyDraft(): TranscriptDraft {
    return {
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        stepIndex: 0,
        uiPhase: 'survey',
        programName: '',
        facilityId: null,
        facilityOther: '',
        facilityName: '',
        completionDate: '',
        confidence: '',
        oneSentence: '',
        topSkills: [],
        whatMadeYouFinish: '',
        goalConnection: '',
        pride: '',
        standoutMoment: '',
        adviceToPeer: '',
        q4Toggle: null,
        q4Text: '',
        q5BeforeTags: [],
        q5AfterTags: [],
        q5FreeText: '',
        q7Text: '',
        q8Selections: [],
        q9Selections: [],
        editingEntryId: undefined
    };
}

const DRAFT_AUTOSAVE_MS = 400;

export function useTranscriptDraft() {
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [draft, setDraft] = useState<TranscriptDraft | null>(null);
    const [hydrated, setHydrated] = useState(false);

    // Maps client_id → backend integer id (never exposed to consumers)
    const entryBackendIds = useRef(new Map<string, number>());
    const draftRef = useRef<TranscriptDraft | null>(null);
    draftRef.current = draft;

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const [{ entries: fetched, backendIds }, fetchedDraft] =
                await Promise.all([apiGetEntries(), apiGetDraft()]);
            if (cancelled) return;
            entryBackendIds.current = backendIds;
            setEntries(fetched);
            setDraft(fetchedDraft);
            setHydrated(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Debounced draft autosave
    useEffect(() => {
        if (!hydrated || !draft) return;
        const t = window.setTimeout(() => {
            void apiUpsertDraft(draft);
        }, DRAFT_AUTOSAVE_MS);
        return () => window.clearTimeout(t);
    }, [draft, hydrated]);

    const updateDraft = useCallback((patch: Partial<TranscriptDraft>) => {
        setDraft((prev) => {
            const base = prev ?? createEmptyDraft();
            return { ...base, ...patch, updatedAt: new Date().toISOString() };
        });
    }, []);

    const ensureDraft = useCallback((): TranscriptDraft => {
        if (draftRef.current) return draftRef.current;
        const fresh = createEmptyDraft();
        setDraft(fresh);
        return fresh;
    }, []);

    const startFreshDraft = useCallback(() => {
        const prev = draftRef.current;
        if (prev) void apiDeleteDraft(prev.id);
        const fresh = createEmptyDraft();
        setDraft(fresh);
        return fresh;
    }, []);

    /**
     * Commit an entry to the server, creating or updating based on whether this
     * client_id has a backend id yet.
     *
     * Rejects when the write fails. `API.fetchWithHandling` resolves
     * `{ success: false }` rather than throwing, so `apiCreateEntry` returns null
     * and `apiUpdateEntry` returns false on a 500, a timeout, or offline — which
     * left this function resolving normally on a failed write. Callers read that as
     * success: the resident saw "Saved", `lr_entry_completed` fired, and Finish
     * navigated home with the entry never persisted. This is the only place that
     * can turn a failed write back into a signal, so it throws and lets callers
     * decide.
     */
    const upsertCommittedEntry = useCallback(async (entry: TranscriptEntry) => {
        const trimmedEntry = {
            ...entry,
            topSkills: entry.topSkills.slice(0, TOP_SKILLS_MAX)
        };
        const backendId = entryBackendIds.current.get(entry.id);
        if (backendId !== undefined) {
            if (!(await apiUpdateEntry(backendId, trimmedEntry))) {
                throw new Error('failed to update learning record entry');
            }
            setEntries((prev) =>
                prev.map((e) => (e.id === entry.id ? trimmedEntry : e))
            );
        } else {
            const result = await apiCreateEntry(trimmedEntry);
            if (!result) {
                throw new Error('failed to create learning record entry');
            }
            entryBackendIds.current.set(entry.id, result.backendId);
            setEntries((prev) => {
                const idx = prev.findIndex((e) => e.id === entry.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = result.entry;
                    return next;
                }
                return [...prev, result.entry];
            });
        }
        dispatchEntrySessionUpdated();
    }, []);

    /**
     * Remove an entry, server-side first.
     *
     * Rejects when the delete fails, for the same reason `upsertCommittedEntry`
     * does — `apiDeleteEntry` returns false rather than throwing. Previously the
     * local removal ran unconditionally, so a failed delete made the row disappear
     * while it still existed on the server, and it reappeared on the next hydrate.
     * Dropping local state only after the server confirms keeps the two in step.
     */
    const deleteCommittedEntry = useCallback(async (id: string) => {
        const backendId = entryBackendIds.current.get(id);
        if (backendId !== undefined) {
            if (!(await apiDeleteEntry(backendId))) {
                throw new Error('failed to delete learning record entry');
            }
            entryBackendIds.current.delete(id);
        }
        setEntries((prev) => prev.filter((e) => e.id !== id));
        dispatchEntrySessionUpdated();
    }, []);

    const reloadEntries = useCallback(() => {
        void (async () => {
            const { entries: fetched, backendIds } = await apiGetEntries();
            entryBackendIds.current = backendIds;
            setEntries(fetched);
        })();
    }, []);

    const persistDraftNow = useCallback(() => {
        const d = draftRef.current;
        if (d) void apiUpsertDraft(d);
    }, []);

    const hasDraft = useMemo(() => draft !== null, [draft]);

    return {
        draft,
        entries,
        hydrated,
        hasDraft,
        updateDraft,
        ensureDraft,
        startFreshDraft,
        upsertCommittedEntry,
        deleteCommittedEntry,
        reloadEntries,
        persistDraftNow
    };
}
