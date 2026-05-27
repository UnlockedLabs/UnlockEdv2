import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/shared';
import type { TranscriptEntry } from '@/types/digital-transcript';
import {
    cloneTranscriptEntry,
    createEmptyTranscriptEntry,
    dispatchEntrySessionUpdated,
    entryHasExportableContent,
    filterEntriesForExport,
    readTranscriptEntriesFromStorage,
    resolveInitialEntrySession,
    sortEntriesNewestFirst,
    syncSessionRowsAfterUpsert,
    writeEntrySessionToStorage
} from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import type { TranscriptEntrySession } from '@/types/digital-transcript';
import { AchievementsRecordPreview } from './AchievementsRecordPreview';
import { AchievementRow } from './AchievementRow';
import type { LearningRecordFormVariant } from './learningRecordPrototypes';
import { TOP_SKILLS_MAX } from './transcriptReflectionConfig';

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
    committed: TranscriptEntry[]
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
    const row = createEmptyTranscriptEntry();
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
    options: { intent?: boolean; edit?: string | null }
): TranscriptEntrySession {
    if (options.intent) {
        const opened = ensureDraftEditorOpen(session, committed);
        const rowId = opened.expandedId ?? opened.rows[0]?.id;
        const row =
            opened.rows.find((r) => r.id === rowId) ??
            findReusableBlankDraftRow(opened.rows, new Set(committed.map((e) => e.id))) ??
            createEmptyTranscriptEntry();
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
        const opened = ensureDraftEditorOpen(session, committed);
        const row =
            opened.rows.find((r) => r.id === opened.expandedId) ??
            opened.rows[0] ??
            createEmptyTranscriptEntry();
        const cloned = cloneTranscriptEntry(row);
        return {
            ...opened,
            rows: [cloned],
            expandedId: cloned.id,
            lastPreviewId: cloned.id
        };
    }

    const preferredId =
        session.expandedId ?? sortEntriesNewestFirst(session.rows)[0]?.id ?? null;
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

interface DigitalTranscriptWysiwygEntryProps {
    base: string;
    formVariant: LearningRecordFormVariant;
    hydrated: boolean;
    entries: TranscriptEntry[];
    upsertCommittedEntry: (entry: TranscriptEntry) => void;
    deleteCommittedEntry: (id: string) => TranscriptEntrySession | null;
    /** Live session rows for PDF export (includes in-progress autosaved work). */
    onExportRowsChange?: (rows: TranscriptEntry[]) => void;
    /** Funnel: register Back handler that commits session rows before navigate. */
    onRegisterBackCommit?: (commit: () => void) => void;
}

export function DigitalTranscriptWysiwygEntry({
    base: _base,
    formVariant,
    hydrated,
    entries,
    upsertCommittedEntry,
    deleteCommittedEntry,
    onExportRowsChange,
    onRegisterBackCommit
}: DigitalTranscriptWysiwygEntryProps) {
    const isFunnel = formVariant === 'funnel';
    const [searchParams, setSearchParams] = useSearchParams();
    const [session, setSession] = useState<TranscriptEntrySession | null>(null);
    const [doneErrorRowId, setDoneErrorRowId] = useState<string | null>(null);
    const [deleteConfirmFor, setDeleteConfirmFor] = useState<TranscriptEntry | null>(null);
    const baselinesRef = useRef<Record<string, TranscriptEntry>>({});
    const prevExpandedIdRef = useRef<string | null>(null);
    const achievementListRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef<TranscriptEntrySession | null>(null);
    sessionRef.current = session;

    const committedIds = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);

    const captureBaseline = useCallback((id: string, rows: TranscriptEntry[]) => {
        const row = rows.find((r) => r.id === id);
        if (row) baselinesRef.current[id] = cloneTranscriptEntry(row);
    }, []);

    const bootstrapped = useRef(false);

    useEffect(() => {
        if (!hydrated || bootstrapped.current) return;
        bootstrapped.current = true;

        const edit = searchParams.get('edit');
        const intent = searchParams.get('intent') === 'new';

        let s = resolveInitialEntrySession();
        const committed = readTranscriptEntriesFromStorage();

        if (isFunnel) {
            s = toFunnelSingleRowSession(s, committed, {
                intent: intent || undefined,
                edit: edit || null
            });
        } else if (intent) {
            s = ensureDraftEditorOpen(s, committed);
        } else if (edit && s.rows.some((r) => r.id === edit)) {
            s = { ...s, expandedId: edit, lastPreviewId: edit };
        } else if (s.rows.length === 0) {
            s = ensureDraftEditorOpen(s, committed);
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
        }
    }, [hydrated, searchParams, setSearchParams, captureBaseline, isFunnel]);

    const commitSessionRowsForBack = useCallback(() => {
        const current = sessionRef.current;
        if (!current) return;
        let nextSession = current;
        for (const row of current.rows) {
            const saved: TranscriptEntry = {
                ...row,
                topSkills: row.topSkills.slice(0, TOP_SKILLS_MAX)
            };
            upsertCommittedEntry(saved);
            nextSession = syncSessionRowsAfterUpsert(nextSession, saved);
        }
        writeEntrySessionToStorage(nextSession);
        dispatchEntrySessionUpdated();
        setSession(nextSession);
    }, [upsertCommittedEntry]);

    useEffect(() => {
        if (!isFunnel || !onRegisterBackCommit) return;
        onRegisterBackCommit(commitSessionRowsForBack);
    }, [isFunnel, onRegisterBackCommit, commitSessionRowsForBack]);

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

    const patchRow = useCallback((id: string, patch: Partial<TranscriptEntry>) => {
        setSession((prev) => {
            if (!prev) return prev;
            const rows = prev.rows.map((r) => {
                if (r.id !== id) return r;
                const nextTop = patch.topSkills ?? r.topSkills;
                return { ...r, ...patch, topSkills: nextTop };
            });
            const lastPreviewId = prev.expandedId === id ? id : prev.lastPreviewId;
            return { ...prev, rows, lastPreviewId };
        });
    }, []);

    const handleToggleExpand = useCallback((id: string) => {
        setSession((prev) => {
            if (!prev) return prev;
            if (prev.expandedId === id) {
                return { ...prev, expandedId: null };
            }
            return { ...prev, expandedId: id, lastPreviewId: id };
        });
        setDoneErrorRowId(null);
    }, []);

    const handleAdd = useCallback(() => {
        const row = createEmptyTranscriptEntry();
        setSession((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                rows: [row, ...prev.rows],
                expandedId: row.id,
                lastPreviewId: row.id
            };
        });
        setDoneErrorRowId(null);
    }, []);

    const isCommittedEntryId = useCallback((id: string) => {
        return readTranscriptEntriesFromStorage().some((e) => e.id === id);
    }, []);

    const handleCancel = useCallback(
        (id: string) => {
            const baseline = baselinesRef.current[id];
            setDoneErrorRowId(null);
            setSession((prev) => {
                if (!prev) return prev;
                const committed = isCommittedEntryId(id);
                const current = prev.rows.find((r) => r.id === id);
                const restored = baseline ? cloneTranscriptEntry(baseline) : current ?? null;
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
            const programOk = Boolean(row.programName.trim());
            const dateOk = Boolean(row.completionDate.trim());
            if (!programOk || !dateOk) {
                setDoneErrorRowId(id);
                return;
            }
            setDoneErrorRowId(null);
            const saved: TranscriptEntry = {
                ...row,
                topSkills: row.topSkills.slice(0, TOP_SKILLS_MAX)
            };
            upsertCommittedEntry(saved);
            setSession((prev) => {
                if (!prev) return prev;
                const next = syncSessionRowsAfterUpsert(prev, saved);
                return { ...next, expandedId: null };
            });
            baselinesRef.current[id] = cloneTranscriptEntry(saved);
        },
        [upsertCommittedEntry]
    );

    const displayRows = useMemo(
        () => (session ? sortEntriesNewestFirst(session.rows) : []),
        [session]
    );

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
              Scroll contract:
              - Editor pane: header fixed; `transcript-achievement-list` scrolls vertically.
              - Preview pane: `achievements-record-preview-scroll` scrolls vertically.
              - Layout chain uses min-h-0 + overflow-hidden so panes do not share one page scroll.
            */}
            <div
                data-slot="transcript-wysiwyg-layout"
                className="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 overflow-hidden bg-muted max-[899px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:grid-cols-[5fr_7fr] min-[900px]:grid-rows-[minmax(0,1fr)] [&>*]:min-h-0"
            >
                <aside
                    data-slot="transcript-wysiwyg-editor-pane"
                    className="m-2 grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm print:hidden"
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
                        <h1 className="text-base font-semibold tracking-tight text-foreground">
                            Your achievements
                        </h1>
                        {!isFunnel && (
                            <button
                                type="button"
                                data-slot="transcript-add-achievement"
                                onClick={handleAdd}
                                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[#556830] transition-colors duration-150 hover:text-[#203622] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Plus className="size-4" aria-hidden />
                                Add achievement
                            </button>
                        )}
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
                                    isExpanded={session.expandedId === entry.id}
                                    onToggleExpand={() => handleToggleExpand(entry.id)}
                                    onPatch={(patch) => patchRow(entry.id, patch)}
                                    onCancel={() => handleCancel(entry.id)}
                                    onDone={() => handleDone(entry.id)}
                                    showDoneErrors={doneErrorRowId === entry.id}
                                    showDelete={committedIds.has(entry.id)}
                                    onDeleteRequest={() => setDeleteConfirmFor(entry)}
                                />
                            ))}
                        </div>
                    </div>
                </aside>

                <div
                    data-slot="transcript-wysiwyg-preview-pane"
                    className="m-2 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm max-[899px]:min-h-0"
                    aria-label="Live preview"
                >
                    <AchievementsRecordPreview rows={session.rows} anchorId={session.expandedId} />
                </div>
            </div>
            <ConfirmDialog
                open={deleteConfirmFor !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteConfirmFor(null);
                }}
                title="Remove this achievement?"
                description={
                    deleteConfirmFor
                        ? `“${deleteConfirmFor.programName.trim() || 'Untitled'}” will be removed from this device. This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="destructive"
                onConfirm={() => {
                    const target = deleteConfirmFor;
                    setDeleteConfirmFor(null);
                    if (!target) return;
                    delete baselinesRef.current[target.id];
                    const next = deleteCommittedEntry(target.id);
                    setSession(next ?? resolveInitialEntrySession());
                }}
            />
        </div>
    );
}
