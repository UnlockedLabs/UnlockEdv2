import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDialog } from '@/components/shared';
import { LearningRecordPrivacyNotice } from '@/components/learning-record/LearningRecordPrivacyNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
    TranscriptEntry,
    TranscriptEntrySession
} from '@/types/digital-transcript';
import {
    cloneTranscriptEntry,
    createEmptyTranscriptEntry,
    dispatchEntrySessionUpdated,
    entryHasExportableContent,
    entryPayloadEqual,
    filterEntriesForExport,
    resolveInitialEntrySession,
    sortEntriesNewestFirst,
    syncSessionRowsAfterUpsert,
    writeEntrySessionToStorage
} from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import { getEntryDisplayTitle } from '@/pages/student/digital-transcript/entryTitleDisplay';
import {
    AchievementsRecordPreview,
    type FunnelDownloadProps
} from './AchievementsRecordPreview';
import { AchievementRow } from './AchievementRow';
import type { LearningRecordFormVariant } from './learningRecordPrototypes';
import {
    entryIsComplete,
    firstIncompleteFunnelStep
} from './learningRecordDocumentModel';
import { CONFIDENCE_LEVEL_SOLID } from './confidenceLevelVisual';
import { LEARNING_RECORD_BUTTON_SIZE } from './learningRecordButtons';
import {
    countFunnelFieldsAnswered,
    countFunnelStepFieldsAnswered,
    countFunnelStepFieldsTotal,
    funnelCompletionTier,
    FUNNEL_FORM_FIELD_TOTAL,
    FUNNEL_FORM_STEPS,
    TOP_SKILLS_MAX
} from './transcriptReflectionConfig';
import { LearningRecordTracker } from './learningRecordAnalytics';
import { enterForm, leaveForm, noteActivity } from './learningRecordSession';

/** Maps a TranscriptEntry patch key to its corresponding preview field id. */
function patchKeyToPreviewField(key: keyof TranscriptEntry): string | null {
    switch (key) {
        case 'programName':
        case 'completionDate':
            return 'programName';
        case 'whatMadeYouFinish':
            return 'whatMadeYouFinish';
        case 'q4Toggle':
        case 'q4Text':
            return 'q4';
        case 'q5BeforeTags':
        case 'q5AfterTags':
        case 'q5FreeText':
            return 'q5';
        case 'adviceToPeer':
            return 'adviceToPeer';
        case 'confidence':
        case 'q7Text':
            return 'confidence';
        case 'q8Selections':
            return 'q8Selections';
        case 'q9Selections':
            return 'q9Selections';
        case 'oneSentence':
            return 'oneSentence';
        default:
            return null;
    }
}

/** Resident's current facility, prefilled as the location on new rows only. */
type DefaultFacility = { id: number; name: string } | null;

/** Newest uncommitted row with no answers yet — safe to reopen instead of duplicating. */
function findReusableBlankDraftRow(
    rows: TranscriptEntry[],
    committedIds: Set<string>
): TranscriptEntry | null {
    for (const row of sortEntriesNewestFirst(rows)) {
        if (committedIds.has(row.id)) continue;
        if (!entryHasExportableContent(row)) return row;
    }
    return null;
}

function ensureDraftEditorOpen(
    session: TranscriptEntrySession,
    committed: TranscriptEntry[],
    defaultFacility: DefaultFacility
): TranscriptEntrySession {
    const committedIds = new Set(committed.map((e) => e.id));
    const reusable = findReusableBlankDraftRow(session.rows, committedIds);
    if (reusable) {
        return {
            ...session,
            expandedId: reusable.id,
            lastPreviewId: reusable.id
        };
    }
    const row = createEmptyTranscriptEntry(defaultFacility);
    return {
        ...session,
        rows: [row, ...session.rows],
        expandedId: row.id,
        lastPreviewId: row.id
    };
}

/** Funnel editor: one achievement row per visit, form expanded. */
function toFunnelSingleRowSession(
    session: TranscriptEntrySession,
    committed: TranscriptEntry[],
    options: {
        intent?: boolean;
        edit?: string | null;
        defaultFacility: DefaultFacility;
    }
): TranscriptEntrySession {
    if (options.intent) {
        const opened = ensureDraftEditorOpen(
            session,
            committed,
            options.defaultFacility
        );
        const rowId = opened.expandedId ?? opened.rows[0]?.id;
        const row =
            opened.rows.find((r) => r.id === rowId) ??
            findReusableBlankDraftRow(
                opened.rows,
                new Set(committed.map((e) => e.id))
            ) ??
            createEmptyTranscriptEntry(options.defaultFacility);
        const cloned = cloneTranscriptEntry(row);
        return {
            ...opened,
            rows: [cloned],
            expandedId: cloned.id,
            lastPreviewId: cloned.id
        };
    }

    if (options.edit) {
        const fromSession = session.rows.find((r) => r.id === options.edit);
        const fromCommitted = committed.find((e) => e.id === options.edit);
        const row = fromSession ?? fromCommitted;
        if (row) {
            const cloned = cloneTranscriptEntry(row);
            return {
                ...session,
                rows: [cloned],
                expandedId: cloned.id,
                lastPreviewId: cloned.id
            };
        }
    }

    if (session.rows.length === 0) {
        const opened = ensureDraftEditorOpen(
            session,
            committed,
            options.defaultFacility
        );
        const row =
            opened.rows.find((r) => r.id === opened.expandedId) ??
            opened.rows[0] ??
            createEmptyTranscriptEntry(options.defaultFacility);
        const cloned = cloneTranscriptEntry(row);
        return {
            ...opened,
            rows: [cloned],
            expandedId: cloned.id,
            lastPreviewId: cloned.id
        };
    }

    const preferredId =
        session.expandedId ??
        sortEntriesNewestFirst(session.rows)[0]?.id ??
        null;
    const row =
        session.rows.find((r) => r.id === preferredId) ?? session.rows[0];
    const cloned = cloneTranscriptEntry(row);
    return {
        ...session,
        rows: [cloned],
        expandedId: cloned.id,
        lastPreviewId: cloned.id
    };
}

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface FunnelAutoSaveState {
    status: AutoSaveStatus;
    lastSavedAt: Date | null;
}

export interface FunnelFinishHandlers {
    /**
     * Async because finishing flushes the debounced autosave before it resolves:
     * navigating away cancels a pending save, so a last-second edit would
     * otherwise be lost.
     */
    validateFinishRequirements: () => Promise<boolean>;
}

const COMMITTED_AUTOSAVE_MS = 500;

interface DigitalTranscriptWysiwygEntryProps {
    formVariant: LearningRecordFormVariant;
    hydrated: boolean;
    entries: TranscriptEntry[];
    upsertCommittedEntry: (entry: TranscriptEntry) => Promise<void>;
    deleteCommittedEntry: (id: string) => Promise<void>;
    /** Live session rows for PDF export (includes in-progress autosaved work). */
    onExportRowsChange?: (rows: TranscriptEntry[]) => void;
    /** Funnel: validate metadata then navigate home (Finish button). */
    funnelOnFinish?: () => void;
    /** Funnel: register Finish validation for the entry page. */
    onRegisterFunnelFinish?: (handlers: FunnelFinishHandlers) => void;
    /** Funnel: report debounced auto-save status for the toolbar label. */
    onFunnelAutoSaveStatusChange?: (state: FunnelAutoSaveState) => void;
    /** Funnel: PDF download wired from the entry page (rendered in the preview pane). */
    funnelDownload?: FunnelDownloadProps;
}

export type { FunnelDownloadProps };

export function DigitalTranscriptWysiwygEntry({
    formVariant,
    hydrated,
    entries,
    upsertCommittedEntry,
    deleteCommittedEntry,
    onExportRowsChange,
    funnelOnFinish,
    onRegisterFunnelFinish,
    onFunnelAutoSaveStatusChange,
    funnelDownload
}: DigitalTranscriptWysiwygEntryProps) {
    const isFunnel = formVariant === 'funnel';
    const { user } = useAuth();
    const defaultFacility = useMemo<DefaultFacility>(
        () =>
            user?.facility_id
                ? { id: user.facility_id, name: user.facility?.name ?? '' }
                : null,
        [user?.facility_id, user?.facility?.name]
    );
    const [searchParams, setSearchParams] = useSearchParams();
    const [session, setSession] = useState<TranscriptEntrySession | null>(null);
    const [saveErrorRowId, setSaveErrorRowId] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [activePreviewField, setActivePreviewField] = useState<string | null>(
        null
    );
    const [deleteConfirmFor, setDeleteConfirmFor] =
        useState<TranscriptEntry | null>(null);
    const baselinesRef = useRef<Record<string, TranscriptEntry>>({});
    /**
     * Last payload this component successfully wrote, per row id. Distinct from
     * `baselinesRef`, which tracks the local editing baseline and is also written
     * from session rows that were never sent anywhere — this one is only ever set
     * on a confirmed write, so it is a true record of what the server holds. Used
     * by `writeActiveRow` to skip a write the server already has.
     */
    const lastWrittenRef = useRef<Record<string, TranscriptEntry>>({});
    const prevExpandedIdRef = useRef<string | null>(null);
    const activePreviewFieldRef = useRef<string | null>(null);
    activePreviewFieldRef.current = activePreviewField;
    const achievementListRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef<TranscriptEntrySession | null>(null);
    sessionRef.current = session;
    // ID-806 question-level behavior tracking. Driven from patchRow /
    // handleActiveStepChange / validateFinishRequirements so it does not depend
    // on the form's markup. Counts and enums only — never answer content.
    const analyticsRef = useRef<LearningRecordTracker | null>(null);
    analyticsRef.current ??= new LearningRecordTracker();
    const analyticsStartedForRef = useRef<string | null>(null);

    const committedIds = useMemo(
        () => new Set(entries.map((e) => e.id)),
        [entries]
    );

    const captureBaseline = useCallback(
        (id: string, rows: TranscriptEntry[]) => {
            const row = rows.find((r) => r.id === id);
            if (row) baselinesRef.current[id] = cloneTranscriptEntry(row);
        },
        []
    );

    const bootstrapped = useRef(false);

    useEffect(() => {
        if (!hydrated || bootstrapped.current) return;
        bootstrapped.current = true;

        const edit = searchParams.get('edit');
        const intent = searchParams.get('intent') === 'new';

        let s = resolveInitialEntrySession(entries);
        const committed = entries;

        if (isFunnel) {
            s = toFunnelSingleRowSession(s, committed, {
                intent: intent || undefined,
                edit: edit ?? null,
                defaultFacility
            });
        } else if (intent) {
            s = ensureDraftEditorOpen(s, committed, defaultFacility);
        } else if (edit && s.rows.some((r) => r.id === edit)) {
            s = { ...s, expandedId: edit, lastPreviewId: edit };
        } else if (s.rows.length === 0) {
            s = ensureDraftEditorOpen(s, committed, defaultFacility);
        }

        if (edit || intent) {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('edit');
                    next.delete('intent');
                    return next;
                },
                { replace: true }
            );
        }

        setSession(s);
        writeEntrySessionToStorage(s);
        dispatchEntrySessionUpdated();

        if (s.expandedId) {
            captureBaseline(s.expandedId, s.rows);
            prevExpandedIdRef.current = s.expandedId;

            if (isFunnel && onFunnelAutoSaveStatusChange) {
                const row = s.rows.find((r) => r.id === s.expandedId);
                const committedEntry = committed.find(
                    (e) => e.id === s.expandedId
                );
                if (
                    row &&
                    committedEntry &&
                    entryPayloadEqual(row, committedEntry)
                ) {
                    onFunnelAutoSaveStatusChange({
                        status: 'saved',
                        lastSavedAt: null
                    });
                }
            }
        }
    }, [
        hydrated,
        entries,
        searchParams,
        setSearchParams,
        captureBaseline,
        isFunnel,
        onFunnelAutoSaveStatusChange,
        defaultFacility
    ]);

    const reportAutoSaveStatus = useCallback(
        (status: AutoSaveStatus, lastSavedAt: Date | null = null) => {
            onFunnelAutoSaveStatusChange?.({ status, lastSavedAt });
        },
        [onFunnelAutoSaveStatusChange]
    );

    /**
     * The debounce timer id lives in a ref, not only in the effect closure, so the
     * Finish flush can cancel a still-pending autosave before it awaits — the
     * effect's own cleanup runs on re-render or unmount, which is far too late to
     * be a cancellation. Safe to share: React runs an effect's cleanup before the
     * next setup, so cleanup can never clear a newer run's timer, and the null
     * check makes a double cancel a no-op.
     */
    const autosaveTimerRef = useRef<number | null>(null);
    const cancelPendingAutoSave = useCallback(() => {
        if (autosaveTimerRef.current === null) return;
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
    }, []);

    /**
     * Ownership of the autosave label. Every save intent — a scheduled debounce,
     * the Finish flush — takes the next ticket, and a save only reports its
     * outcome while it still holds the latest one.
     *
     * Two orderings need this. Serializing writes makes it possible for a
     * superseded save to resolve after a newer one has already started and repaint
     * 'saved' over its 'saving'. And even before serialization, an in-flight save
     * could resolve 'saved' over the 'pending' of an edit made while it was on the
     * wire — claiming the ticket at schedule time rather than at fire time closes
     * both.
     */
    const saveTicketRef = useRef(0);
    const nextSaveTicket = useCallback(() => {
        saveTicketRef.current += 1;
        return saveTicketRef.current;
    }, []);
    const isLatestSaveTicket = useCallback(
        (ticket: number) => ticket === saveTicketRef.current,
        []
    );

    const buildSavedEntry = useCallback(
        (row: TranscriptEntry): TranscriptEntry => {
            const existing = entries.find((e) => e.id === row.id);
            return {
                ...row,
                createdAt: existing?.createdAt ?? row.createdAt,
                topSkills: row.topSkills.slice(0, TOP_SKILLS_MAX)
            };
        },
        [entries]
    );

    /**
     * The actual write. Never call this directly — go through `persistActiveRow`,
     * which serializes attempts. Reads the live session through `sessionRef`, so a
     * caller that waited in the queue writes what the resident has typed by then,
     * not what was on screen when it was enqueued.
     */
    const writeActiveRow = useCallback(async (): Promise<boolean> => {
        const current = sessionRef.current;
        const id = current?.expandedId;
        if (!id) return false;
        const row = current.rows.find((r) => r.id === id);
        if (!row) return false;

        const saved = buildSavedEntry(row);
        // Two independent answers to "does the server already have this". `entries`
        // is the committed state from the hook, but it only refreshes on re-render:
        // a queued attempt resumes on the microtask queue, ahead of the re-render
        // carrying the previous attempt's setEntries, so on its own it would always
        // read stale and issue a redundant PUT. `lastWrittenRef` is set
        // synchronously on the success path below, so it closes that window without
        // depending on render timing.
        const existing = entries.find((e) => e.id === id);
        const lastWritten = lastWrittenRef.current[id];
        if (
            (existing && entryPayloadEqual(saved, existing)) ||
            (lastWritten && entryPayloadEqual(saved, lastWritten))
        ) {
            return true;
        }

        try {
            await upsertCommittedEntry(saved);
            setSession((prev) => {
                if (!prev) return prev;
                const next = syncSessionRowsAfterUpsert(prev, saved);
                return {
                    ...next,
                    expandedId: saved.id,
                    lastPreviewId: saved.id
                };
            });
            baselinesRef.current[id] = cloneTranscriptEntry(saved);
            lastWrittenRef.current[id] = cloneTranscriptEntry(saved);
            return true;
        } catch {
            return false;
        }
    }, [buildSavedEntry, upsertCommittedEntry, entries]);

    /**
     * Serializes writes so two callers can never have an upsert in flight for the
     * same row at once. The debounced autosave and the Finish flush overlap by
     * design — the timer's save can still be awaiting the server when Finish fires
     * — and running them concurrently is worse than a wasted request:
     * `upsertCommittedEntry` chooses POST vs PUT from a client_id → backend id map
     * written only *after* the create resolves, so two racing calls for a row with
     * no id yet both POST, and the unique index on (user_id, client_id) rejects the
     * loser. That surfaced as "Saved" while the losing call's newer answers were
     * dropped.
     *
     * Each caller gets the promise for its own attempt, so it still sees its own
     * boolean. The queue link carries both handlers deliberately: a failed or
     * throwing attempt must not stall the chain or reject an unrelated caller.
     */
    const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

    const persistActiveRow = useCallback((): Promise<boolean> => {
        const attempt = persistQueueRef.current.then(() => writeActiveRow());
        persistQueueRef.current = attempt.then(
            () => undefined,
            () => undefined
        );
        return attempt;
    }, [writeActiveRow]);

    const validateFinishRequirements =
        useCallback(async (): Promise<boolean> => {
            const current = sessionRef.current;
            const id = current?.expandedId;
            if (!id) return false;
            const row = current.rows.find((r) => r.id === id);
            if (!row) return false;

            if (!entryIsComplete(row, 'funnel')) {
                setSaveErrorRowId(id);
                setActiveStep(firstIncompleteFunnelStep(row));
                setActivePreviewField(null);
                return false;
            }

            // Flush the debounced autosave before finishing. Finishing navigates
            // away, which unmounts this component and cancels any pending save, so
            // an edit made within COMMITTED_AUTOSAVE_MS of the click would never
            // reach the server. persistActiveRow reads the live session and no-ops
            // when the row already matches what is committed.
            //
            // Cancel the pending debounce first: this flush writes the same live
            // row that timer would have written, so letting it fire afterwards is
            // pure duplicate traffic. That is a cancellation, not the race fix — a
            // timer that has already fired is mid-request and cannot be called
            // back, which is what persistActiveRow's queue is for. Deliberately
            // after the completeness check above, so an incomplete row keeps its
            // pending autosave and partial answers still reach the server.
            cancelPendingAutoSave();
            nextSaveTicket();
            reportAutoSaveStatus('saving');
            if (!(await persistActiveRow())) {
                setSaveErrorRowId(id);
                reportAutoSaveStatus('error');
                return false;
            }
            reportAutoSaveStatus('saved', new Date());

            setSaveErrorRowId(null);
            // Success path only, mirroring the attendance/program convention: the
            // row is complete, saved, and the resident is finishing. The tracker
            // refuses a second completion for the same entry and reports the
            // accepted one to the session itself, so the sitting's count advances
            // only when an event was actually emitted.
            analyticsRef.current?.entryCompleted(row, id);
            return true;
        }, [
            persistActiveRow,
            reportAutoSaveStatus,
            cancelPendingAutoSave,
            nextSaveTicket
        ]);

    useEffect(() => {
        if (!isFunnel || !onRegisterFunnelFinish) return;
        onRegisterFunnelFinish({ validateFinishRequirements });
    }, [isFunnel, onRegisterFunnelFinish, validateFinishRequirements]);

    // ID-830: mark this mount as a visit to the form. The session itself lives in
    // learningRecordSession, not here, because this component unmounts on every
    // list <-> entry navigation — one sitting used to emit several partial
    // lr_session_ended events. leaveForm deliberately does not emit; it stops
    // active time accruing and lets the module's resume window decide when the
    // sitting is over. pagehide is registered by the module for the same reason:
    // registered here it would be gone the moment this unmounts.
    useEffect(() => {
        if (!isFunnel) return;
        enterForm();
        return () => {
            // Report the step the resident was standing on before the session
            // window closes — otherwise abandoning mid-form is the one path that
            // emits nothing for the question in front of them. Read through
            // sessionRef so the cleanup sees the row as it is now, not as it was
            // when this effect ran.
            const current = sessionRef.current;
            const row = current?.rows.find((r) => r.id === current.expandedId);
            if (row) analyticsRef.current?.abandonedCurrentStep(row);
            leaveForm();
        };
    }, [isFunnel]);

    // ID-806: one lr_entry_started per entry actually opened for editing.
    // Gated on hydrated + an expanded row so loading and empty renders are not
    // counted, the same guard the attendance page uses.
    const analyticsExpandedId = session?.expandedId ?? null;
    useEffect(() => {
        if (!isFunnel || !hydrated || !analyticsExpandedId) return;
        if (analyticsStartedForRef.current === analyticsExpandedId) return;
        analyticsStartedForRef.current = analyticsExpandedId;
        analyticsRef.current?.entryStarted(analyticsExpandedId);
    }, [isFunnel, hydrated, analyticsExpandedId]);

    useEffect(() => {
        if (!isFunnel || !session?.expandedId || !onFunnelAutoSaveStatusChange)
            return;

        const row = session.rows.find((r) => r.id === session.expandedId);
        if (!row) return;

        const saved = buildSavedEntry(row);
        const committed = entries.find((e) => e.id === row.id);
        if (committed && entryPayloadEqual(saved, committed)) {
            return;
        }

        reportAutoSaveStatus('pending');

        // Claim the label before scheduling. Any save already in flight now holds a
        // stale ticket, so it cannot resolve and paint 'saved' over this newer dirty
        // state. A still-pending timer always holds the latest ticket — every later
        // intent cancels it first — which is why 'saving' below needs no guard while
        // the outcome does.
        const ticket = nextSaveTicket();

        autosaveTimerRef.current = window.setTimeout(() => {
            autosaveTimerRef.current = null;
            void (async () => {
                reportAutoSaveStatus('saving');
                const ok = await persistActiveRow();
                if (!isLatestSaveTicket(ticket)) return;
                if (ok) {
                    reportAutoSaveStatus('saved', new Date());
                } else {
                    reportAutoSaveStatus('error');
                }
            })();
        }, COMMITTED_AUTOSAVE_MS);

        return cancelPendingAutoSave;
    }, [
        isFunnel,
        session,
        entries,
        buildSavedEntry,
        persistActiveRow,
        reportAutoSaveStatus,
        cancelPendingAutoSave,
        nextSaveTicket,
        isLatestSaveTicket,
        onFunnelAutoSaveStatusChange
    ]);

    useEffect(() => {
        if (!session) return;
        const id = session.expandedId;
        if (id === prevExpandedIdRef.current) return;
        prevExpandedIdRef.current = id;
        if (id) captureBaseline(id, session.rows);
    }, [session, session?.expandedId, captureBaseline]);

    useEffect(() => {
        if (!session) return;
        const t = window.setTimeout(() => {
            writeEntrySessionToStorage(session);
            dispatchEntrySessionUpdated();
        }, 400);
        return () => window.clearTimeout(t);
    }, [session]);

    useEffect(() => {
        if (!session) {
            onExportRowsChange?.([]);
            return;
        }
        onExportRowsChange?.(filterEntriesForExport(session.rows));
    }, [session, onExportRowsChange]);

    const handleActiveStepChange = useCallback((step: number) => {
        setActiveStep((prevStep) => {
            const current = sessionRef.current;
            const row = current?.rows.find((r) => r.id === current.expandedId);
            if (row && step !== prevStep) {
                analyticsRef.current?.stepChanged(row, prevStep, step);
            }
            return step;
        });
        setActivePreviewField(null);
        achievementListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const patchRow = useCallback(
        (id: string, patch: Partial<TranscriptEntry>) => {
            if (isFunnel) {
                const patchedKey = (Object.keys(patch)[0] ?? null) as
                    | keyof TranscriptEntry
                    | null;
                if (patchedKey) {
                    const previewField = patchKeyToPreviewField(patchedKey);
                    if (
                        previewField !== null &&
                        previewField !== activePreviewFieldRef.current
                    ) {
                        setActivePreviewField(previewField);
                    }
                    analyticsRef.current?.noteEdit(patchedKey);
                    noteActivity();
                }
            }
            setSession((prev) => {
                if (!prev) return prev;
                const rows = prev.rows.map((r) => {
                    if (r.id !== id) return r;
                    const nextTop = patch.topSkills ?? r.topSkills;
                    return { ...r, ...patch, topSkills: nextTop };
                });
                const lastPreviewId =
                    prev.expandedId === id ? id : prev.lastPreviewId;
                return { ...prev, rows, lastPreviewId };
            });
        },
        [isFunnel]
    );

    const handleToggleExpand = useCallback((id: string) => {
        setSession((prev) => {
            if (!prev) return prev;
            if (prev.expandedId === id) {
                return { ...prev, expandedId: null };
            }
            return { ...prev, expandedId: id, lastPreviewId: id };
        });
        setSaveErrorRowId(null);
    }, []);

    const handleAdd = useCallback(() => {
        const row = createEmptyTranscriptEntry(defaultFacility);
        setSession((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                rows: [row, ...prev.rows],
                expandedId: row.id,
                lastPreviewId: row.id
            };
        });
        setSaveErrorRowId(null);
    }, [defaultFacility]);

    const isCommittedEntryId = useCallback(
        (id: string) => {
            return committedIds.has(id);
        },
        [committedIds]
    );

    const handleCancel = useCallback(
        (id: string) => {
            const baseline = baselinesRef.current[id];
            setSaveErrorRowId(null);
            setSession((prev) => {
                if (!prev) return prev;
                const committed = isCommittedEntryId(id);
                const current = prev.rows.find((r) => r.id === id);
                const restored = baseline
                    ? cloneTranscriptEntry(baseline)
                    : (current ?? null);
                if (!restored) {
                    return { ...prev, expandedId: null };
                }
                let rows = prev.rows.map((r) => (r.id === id ? restored : r));
                if (!committed && !entryHasExportableContent(restored)) {
                    rows = rows.filter((r) => r.id !== id);
                }
                const lastPreviewId =
                    rows.length > 0 ? rows[rows.length - 1].id : null;
                return {
                    ...prev,
                    rows,
                    expandedId: null,
                    lastPreviewId
                };
            });
        },
        [isCommittedEntryId]
    );

    const handleDone = useCallback(
        (id: string) => {
            const row = sessionRef.current?.rows.find((r) => r.id === id);
            if (!row) return;
            if (!entryIsComplete(row, formVariant)) {
                setSaveErrorRowId(id);
                return;
            }
            setSaveErrorRowId(null);
            const saved: TranscriptEntry = {
                ...row,
                topSkills: row.topSkills.slice(0, TOP_SKILLS_MAX)
            };
            // Fire-and-forget, but upsertCommittedEntry now rejects on a failed
            // write, so the rejection has to be handled here or it surfaces as an
            // unhandled promise rejection. The categories variant has no autosave
            // label, so the row's save-error state is the only channel available —
            // the same one the incomplete-row check above uses.
            void upsertCommittedEntry(saved).catch(() => setSaveErrorRowId(id));
            setSession((prev) => {
                if (!prev) return prev;
                const next = syncSessionRowsAfterUpsert(prev, saved);
                return { ...next, expandedId: null };
            });
            baselinesRef.current[id] = cloneTranscriptEntry(saved);
        },
        [formVariant, upsertCommittedEntry]
    );

    const handleConfirmDeleteEntry = useCallback(() => {
        const target = deleteConfirmFor;
        setDeleteConfirmFor(null);
        if (!target) return;
        // Drop local state only once the server confirms. deleteCommittedEntry now
        // rejects on a failed delete and keeps the entry, so removing the row up
        // front would hide a record that still exists — it would come back on the
        // next hydrate, which reads as data loss in reverse.
        void deleteCommittedEntry(target.id)
            .then(() => {
                delete baselinesRef.current[target.id];
                delete lastWrittenRef.current[target.id];
                setSession((prev) => {
                    if (!prev) return null;
                    const rows = prev.rows.filter((r) => r.id !== target.id);
                    // Deleting the last row must not null the session: bootstrapped
                    // is already true, so nothing reinitializes it and the editor
                    // would sit on its loading state until a reload. Reopen a blank
                    // draft, the same way bootstrap recovers from an empty session.
                    if (rows.length === 0) {
                        return ensureDraftEditorOpen(
                            {
                                ...prev,
                                rows,
                                expandedId: null,
                                lastPreviewId: null
                            },
                            entries,
                            defaultFacility
                        );
                    }
                    const expandedId =
                        prev.expandedId === target.id ? null : prev.expandedId;
                    const lastPreviewId =
                        prev.lastPreviewId === target.id
                            ? (rows[rows.length - 1]?.id ?? null)
                            : prev.lastPreviewId;
                    return { ...prev, rows, expandedId, lastPreviewId };
                });
            })
            .catch(() => {
                toast.error('Could not delete that entry. Please try again.');
            });
    }, [deleteConfirmFor, deleteCommittedEntry, entries, defaultFacility]);

    const displayRows = useMemo(
        () => (session ? sortEntriesNewestFirst(session.rows) : []),
        [session]
    );

    const funnelEntry = isFunnel ? (displayRows[0] ?? null) : null;
    const funnelAnswered = funnelEntry
        ? countFunnelFieldsAnswered(funnelEntry)
        : 0;
    const funnelCompletionBadgeBg = funnelEntry
        ? CONFIDENCE_LEVEL_SOLID[
              funnelCompletionTier(funnelAnswered, FUNNEL_FORM_FIELD_TOTAL) - 1
          ]
        : null;

    const expandedId = session?.expandedId ?? null;

    useLayoutEffect(() => {
        if (!expandedId || !achievementListRef.current) return;
        const row = achievementListRef.current.querySelector<HTMLElement>(
            `[data-achievement-id="${expandedId}"]`
        );
        row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [expandedId, displayRows.length]);

    if (!hydrated || !session) {
        return (
            <div
                data-slot="transcript-wysiwyg-outer"
                className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
            >
                <div
                    className="size-8 rounded-full border-2 border-primary/25 border-t-primary animate-spin"
                    aria-hidden
                />
                <p className="text-sm font-medium">Loading your editor…</p>
            </div>
        );
    }

    return (
        <div
            data-slot="transcript-wysiwyg-outer"
            className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
        >
            {/*
              Unconditional: the progress card below is funnel-only, so rendering
              the notice outside that guard gives both variants the disclosure
              while still sitting directly above the progress bar where one
              exists. `shrink-0` keeps it out of the panes' scroll areas.
            */}
            {/*
              `w-auto` is required, not cosmetic: `Alert`'s base classes include
              `w-full`, which combined with `mx-4` makes the notice 32px wider
              than its container — the right border overflows and is clipped by
              the parent's `overflow-hidden`. `w-auto` lets the margins shrink
              the box instead (twMerge drops `w-full` in favour of it). The
              sibling progress Card gets away with plain `mx-4` because `Card`
              has no `w-full`.
            */}
            <LearningRecordPrivacyNotice
                variant="full"
                className="mx-4 mt-4 w-auto shrink-0 print:hidden"
            />
            {isFunnel && funnelEntry && funnelCompletionBadgeBg ? (
                <Card
                    data-slot="funnel-form-progress"
                    className="mx-4 mt-4 shrink-0 p-4"
                >
                    <div className="flex items-start gap-4">
                        <div
                            role="tablist"
                            aria-label="Form sections"
                            className="grid min-w-0 flex-1 grid-cols-3 gap-4 overflow-x-auto"
                        >
                            {FUNNEL_FORM_STEPS.map((step, index) => {
                                const answered = countFunnelStepFieldsAnswered(
                                    index,
                                    funnelEntry
                                );
                                const total = countFunnelStepFieldsTotal(index);
                                const fillPct =
                                    total > 0 ? (answered / total) * 100 : 0;
                                const isActive = index === activeStep;
                                return (
                                    <button
                                        key={step.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        tabIndex={isActive ? 0 : -1}
                                        className={cn(
                                            'min-w-0 space-y-1.5 px-2 py-2 text-left transition-all duration-150',
                                            isActive
                                                ? 'rounded-md border border-[#556830] bg-background'
                                                : 'cursor-pointer rounded-md border border-transparent hover:bg-muted'
                                        )}
                                        onClick={() =>
                                            handleActiveStepChange(index)
                                        }
                                    >
                                        <span
                                            className={cn(
                                                'block whitespace-nowrap text-xs leading-snug',
                                                isActive
                                                    ? 'font-semibold text-foreground'
                                                    : 'font-normal text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {step.title} ({answered}/{total})
                                        </span>
                                        <span className="block h-2 overflow-hidden rounded-full bg-muted">
                                            <span
                                                className="block h-full rounded-full bg-[#556830] transition-[width] duration-200"
                                                style={{ width: `${fillPct}%` }}
                                                role="img"
                                                aria-label={`${step.title}: ${answered} of ${total} answered`}
                                            />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <Badge
                            variant="secondary"
                            className={cn(
                                'shrink-0 self-center border-border/60 px-2.5 py-1 text-xs font-medium tabular-nums text-black',
                                funnelCompletionBadgeBg
                            )}
                        >
                            {funnelAnswered} / {FUNNEL_FORM_FIELD_TOTAL}{' '}
                            questions answered
                        </Badge>
                    </div>
                </Card>
            ) : null}
            {/*
              Scroll contract:
              - Editor pane: header fixed; `transcript-achievement-list` scrolls vertically.
              - Preview pane: `achievements-record-preview-scroll` scrolls vertically.
              - Layout chain uses min-h-0 + overflow-hidden so panes do not share one page scroll.
            */}
            <div
                data-slot="transcript-wysiwyg-layout"
                className={cn(
                    'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 overflow-hidden max-[899px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:grid-rows-[minmax(0,1fr)] [&>*]:min-h-0',
                    isFunnel
                        ? 'gap-4 bg-muted p-4 min-[900px]:grid-cols-2'
                        : 'bg-muted max-[899px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:grid-cols-[5fr_7fr]'
                )}
            >
                {isFunnel ? (
                    <Card
                        data-slot="transcript-wysiwyg-editor-pane"
                        className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden p-0 print:hidden"
                    >
                        <div
                            ref={achievementListRef}
                            data-slot="transcript-achievement-list"
                            className="min-h-0 overflow-y-auto overscroll-contain p-2"
                        >
                            <div className="flex flex-col gap-2.5">
                                {displayRows.map((entry) => (
                                    <AchievementRow
                                        key={entry.id}
                                        formVariant={formVariant}
                                        entry={entry}
                                        isExpanded={
                                            session.expandedId === entry.id
                                        }
                                        onToggleExpand={() =>
                                            handleToggleExpand(entry.id)
                                        }
                                        onPatch={(patch) =>
                                            patchRow(entry.id, patch)
                                        }
                                        onCancel={undefined}
                                        onDone={undefined}
                                        showDoneErrors={false}
                                        showSaveErrors={
                                            saveErrorRowId === entry.id
                                        }
                                        activeStep={activeStep}
                                        onActiveStepChange={
                                            handleActiveStepChange
                                        }
                                        onFinish={funnelOnFinish}
                                        showDelete={committedIds.has(entry.id)}
                                        onDeleteRequest={() =>
                                            setDeleteConfirmFor(entry)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    </Card>
                ) : (
                    <aside
                        data-slot="transcript-wysiwyg-editor-pane"
                        className="m-2 grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm print:hidden"
                    >
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
                            <h1 className="text-base font-semibold tracking-tight text-foreground">
                                Your achievements
                            </h1>
                            <Button
                                type="button"
                                variant="ghost"
                                size={LEARNING_RECORD_BUTTON_SIZE}
                                data-slot="transcript-add-achievement"
                                onClick={handleAdd}
                                className="h-10 shrink-0 gap-1.5 px-3 text-[#556830] hover:bg-muted hover:text-[#203622]"
                            >
                                <Plus className="size-4" aria-hidden />
                                Add achievement
                            </Button>
                        </div>

                        <div
                            ref={achievementListRef}
                            data-slot="transcript-achievement-list"
                            className="min-h-0 overflow-y-auto overscroll-contain bg-background p-2"
                        >
                            <div className="flex flex-col gap-2.5">
                                {displayRows.map((entry) => (
                                    <AchievementRow
                                        key={entry.id}
                                        formVariant={formVariant}
                                        entry={entry}
                                        isExpanded={
                                            session.expandedId === entry.id
                                        }
                                        onToggleExpand={() =>
                                            handleToggleExpand(entry.id)
                                        }
                                        onPatch={(patch) =>
                                            patchRow(entry.id, patch)
                                        }
                                        onCancel={() => handleCancel(entry.id)}
                                        onDone={() => handleDone(entry.id)}
                                        showDoneErrors={
                                            saveErrorRowId === entry.id
                                        }
                                        showSaveErrors={false}
                                        activeStep={activeStep}
                                        onActiveStepChange={
                                            handleActiveStepChange
                                        }
                                        showDelete={committedIds.has(entry.id)}
                                        onDeleteRequest={() =>
                                            setDeleteConfirmFor(entry)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    </aside>
                )}

                {isFunnel ? (
                    <AchievementsRecordPreview
                        rows={session.rows}
                        anchorId={session.expandedId}
                        variant="funnel"
                        funnelDownload={funnelDownload}
                        activeStep={activeStep}
                        activePreviewField={activePreviewField}
                    />
                ) : (
                    <div
                        data-slot="transcript-wysiwyg-preview-pane"
                        className="m-2 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm max-[899px]:min-h-0"
                        aria-label="Live preview"
                    >
                        <AchievementsRecordPreview
                            rows={session.rows}
                            anchorId={session.expandedId}
                            variant="default"
                        />
                    </div>
                )}
            </div>
            <ConfirmDialog
                open={deleteConfirmFor !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteConfirmFor(null);
                }}
                title="Remove this achievement?"
                description={
                    deleteConfirmFor
                        ? `“${getEntryDisplayTitle(deleteConfirmFor.programName, 'Untitled')}” will be removed from your learning record. This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="destructive"
                buttonClassName="h-10"
                onConfirm={handleConfirmDeleteEntry}
            />
        </div>
    );
}
