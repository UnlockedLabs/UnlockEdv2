import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TranscriptEntry, TranscriptEntrySession } from '@/types/digital-transcript';
import {
    cloneTranscriptEntry,
    createEmptyTranscriptEntry,
    dispatchEntrySessionUpdated,
    entryHasExportableContent,
    entryPayloadEqual,
    filterEntriesForExport,
    readTranscriptEntriesFromStorage,
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

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface FunnelAutoSaveState {
    status: AutoSaveStatus;
    lastSavedAt: Date | null;
}

export interface FunnelFinishHandlers {
    validateFinishRequirements: () => boolean;
}

const COMMITTED_AUTOSAVE_MS = 500;

interface DigitalTranscriptWysiwygEntryProps {
    formVariant: LearningRecordFormVariant;
    hydrated: boolean;
    entries: TranscriptEntry[];
    upsertCommittedEntry: (entry: TranscriptEntry) => void;
    deleteCommittedEntry: (id: string) => TranscriptEntrySession | null;
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
    const [searchParams, setSearchParams] = useSearchParams();
    const [session, setSession] = useState<TranscriptEntrySession | null>(null);
    const [saveErrorRowId, setSaveErrorRowId] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
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

            if (isFunnel && onFunnelAutoSaveStatusChange) {
                const row = s.rows.find((r) => r.id === s.expandedId);
                const committedEntry = committed.find((e) => e.id === s.expandedId);
                if (row && committedEntry && entryPayloadEqual(row, committedEntry)) {
                    onFunnelAutoSaveStatusChange({ status: 'saved', lastSavedAt: null });
                }
            }
        }
    }, [hydrated, searchParams, setSearchParams, captureBaseline, isFunnel, onFunnelAutoSaveStatusChange]);

    const reportAutoSaveStatus = useCallback(
        (status: AutoSaveStatus, lastSavedAt: Date | null = null) => {
            onFunnelAutoSaveStatusChange?.({ status, lastSavedAt });
        },
        [onFunnelAutoSaveStatusChange]
    );

    const buildSavedEntry = useCallback((row: TranscriptEntry): TranscriptEntry => {
        const existing = readTranscriptEntriesFromStorage().find((e) => e.id === row.id);
        return {
            ...row,
            createdAt: existing?.createdAt ?? row.createdAt,
            topSkills: row.topSkills.slice(0, TOP_SKILLS_MAX)
        };
    }, []);

    const persistActiveRow = useCallback((): boolean => {
        const current = sessionRef.current;
        const id = current?.expandedId;
        if (!id) return false;
        const row = current.rows.find((r) => r.id === id);
        if (!row) return false;

        const saved = buildSavedEntry(row);
        const existing = readTranscriptEntriesFromStorage().find((e) => e.id === id);
        if (existing && entryPayloadEqual(saved, existing)) {
            return true;
        }

        try {
            upsertCommittedEntry(saved);
            setSession((prev) => {
                if (!prev) return prev;
                const next = syncSessionRowsAfterUpsert(prev, saved);
                return { ...next, expandedId: saved.id, lastPreviewId: saved.id };
            });
            baselinesRef.current[id] = cloneTranscriptEntry(saved);
            return true;
        } catch {
            return false;
        }
    }, [buildSavedEntry, upsertCommittedEntry]);

    const validateFinishRequirements = useCallback((): boolean => {
        const current = sessionRef.current;
        const id = current?.expandedId;
        if (!id) return false;
        const row = current.rows.find((r) => r.id === id);
        if (!row) return false;

        if (!entryIsComplete(row, 'funnel')) {
            setSaveErrorRowId(id);
            setActiveStep(firstIncompleteFunnelStep(row));
            return false;
        }

        setSaveErrorRowId(null);
        return true;
    }, []);

    useEffect(() => {
        if (!isFunnel || !onRegisterFunnelFinish) return;
        onRegisterFunnelFinish({ validateFinishRequirements });
    }, [isFunnel, onRegisterFunnelFinish, validateFinishRequirements]);

    useEffect(() => {
        if (!isFunnel || !session?.expandedId || !onFunnelAutoSaveStatusChange) return;

        const row = session.rows.find((r) => r.id === session.expandedId);
        if (!row) return;

        const saved = buildSavedEntry(row);
        const committed = readTranscriptEntriesFromStorage().find((e) => e.id === row.id);
        if (committed && entryPayloadEqual(saved, committed)) {
            return;
        }

        reportAutoSaveStatus('pending');

        const t = window.setTimeout(() => {
            reportAutoSaveStatus('saving');
            const ok = persistActiveRow();
            if (ok) {
                reportAutoSaveStatus('saved', new Date());
            } else {
                reportAutoSaveStatus('error');
            }
        }, COMMITTED_AUTOSAVE_MS);

        return () => window.clearTimeout(t);
    }, [
        isFunnel,
        session,
        buildSavedEntry,
        persistActiveRow,
        reportAutoSaveStatus,
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
        setSaveErrorRowId(null);
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
        setSaveErrorRowId(null);
    }, []);

    const isCommittedEntryId = useCallback((id: string) => {
        return readTranscriptEntriesFromStorage().some((e) => e.id === id);
    }, []);

    const handleCancel = useCallback(
        (id: string) => {
            const baseline = baselinesRef.current[id];
            setSaveErrorRowId(null);
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
            if (!entryIsComplete(row, formVariant)) {
                setSaveErrorRowId(id);
                return;
            }
            setSaveErrorRowId(null);
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
        [formVariant, upsertCommittedEntry]
    );

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
                                        onClick={() => {
                                            if (index !== activeStep) {
                                                setActiveStep(index);
                                            }
                                        }}
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
                                        isExpanded={session.expandedId === entry.id}
                                        onToggleExpand={() => handleToggleExpand(entry.id)}
                                        onPatch={(patch) => patchRow(entry.id, patch)}
                                        onCancel={undefined}
                                        onDone={undefined}
                                        showDoneErrors={false}
                                        showSaveErrors={saveErrorRowId === entry.id}
                                        activeStep={activeStep}
                                        onActiveStepChange={setActiveStep}
                                        onFinish={funnelOnFinish}
                                        showDelete={committedIds.has(entry.id)}
                                        onDeleteRequest={() => setDeleteConfirmFor(entry)}
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
                                        isExpanded={session.expandedId === entry.id}
                                        onToggleExpand={() => handleToggleExpand(entry.id)}
                                        onPatch={(patch) => patchRow(entry.id, patch)}
                                        onCancel={() => handleCancel(entry.id)}
                                        onDone={() => handleDone(entry.id)}
                                        showDoneErrors={saveErrorRowId === entry.id}
                                        showSaveErrors={false}
                                        activeStep={activeStep}
                                        onActiveStepChange={setActiveStep}
                                        showDelete={committedIds.has(entry.id)}
                                        onDeleteRequest={() => setDeleteConfirmFor(entry)}
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
