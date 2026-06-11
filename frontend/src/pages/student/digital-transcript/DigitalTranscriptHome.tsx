import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronsUpDown, ChevronUp, Download, Eye, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/shared';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import { cn } from '@/lib/utils';
import {
    downloadLearningRecordPdf,
    learningRecordPdfFilename
} from '@/utils/downloadLearningRecordPdf';
import type { TranscriptEntry } from '@/types/digital-transcript';
import {
    countAnsweredReflections,
    reflectionSlotsTotal
} from '@/pages/student/digital-transcript/learningRecordDocumentModel';
import { CONFIDENCE_LEVEL_SOLID } from './confidenceLevelVisual';
import { getDigitalTranscriptBasePath, setDigitalTranscriptStorageContext } from './digitalTranscriptRoutes';
import {
    getLearningRecordFormVariant,
    type LearningRecordFormVariant
} from './learningRecordPrototypes';
import { DigitalTranscriptEyebrow, DigitalTranscriptShell } from './DigitalTranscriptShell';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { learningRecordResidentDisplayName } from './learningRecordResidentName';
import { TranscriptResumePreview } from './TranscriptResumePreview';
import { ViewAllAchievementsSheet } from './ViewAllAchievementsSheet';
import { PrintShareHelpLink } from '@/components/learning-record/PrintShareHelpLink';
import {
    countFunnelFieldsAnswered,
    funnelCompletionTier,
    FUNNEL_FORM_FIELD_TOTAL
} from './transcriptReflectionConfig';
import { getEntryDisplayTitle } from './entryTitleDisplay';
import {
    readTableSortFromSession,
    sortTranscriptEntries,
    toggleTableSort,
    writeTableSortToSession,
    type SortColumn,
    type TableSort
} from './learningRecordTableSort';
import {
    LEARNING_RECORD_BUTTON_SIZE,
    learningRecordOutlineButtonClassName,
    learningRecordPrimaryButtonClassName
} from './learningRecordButtons';

/** Decorative sample for the home CTA thumbnail (not persisted). */
const ACHIEVEMENT_LOG_THUMBNAIL_SAMPLE: TranscriptEntry = {
    id: '__home_thumb_sample__',
    createdAt: '',
    programName: 'Your next achievement',
    completionDate: '2025-06-01',
    topSkills: ['Study habits', 'Test strategies', 'Time management'],
    whatMadeYouFinish: 'Checking off each milestone kept me going.',
    confidence: '4',
    pride: 'Sticking with it when the material felt impossible at first.',
    goalConnection: 'A clear step toward licensing and steadier work.',
    standoutMoment: 'Instructors who explained things with patience and respect.',
    adviceToPeer: 'Use the tutor hours—you are not alone in the room.',
    oneSentence: 'A program that helped me believe I could finish what I started.',
    q4Toggle: null,
    q4Text: '',
    q5BeforeTags: [],
    q5AfterTags: [],
    q5FreeText: '',
    q7Text: '',
    q8Selections: [],
    q9Selections: []
};

const FUNNEL_SUBTITLE =
    "This is your personal record of the programs you've finished and the skills you've built. Everything you add is saved here. When you're ready, you can save your record as a PDF to print, share, or take with you.";

const EMPTY_FIELD_LABEL = 'Not added yet';

const primaryCtaClassName = cn(learningRecordPrimaryButtonClassName, 'sm:min-w-[11rem]');

function formatProgramCompletedDate(entry: TranscriptEntry): string {
    if (!entry.completionDate.trim()) return EMPTY_FIELD_LABEL;
    return new Date(entry.completionDate + 'T12:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatSavedOn(iso: string): string {
    if (!iso.trim()) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function savedHereLabel(count: number): string {
    const word = count === 1 ? 'achievement' : 'achievements';
    return `You have ${count} ${word} saved here.`;
}

function getEntryQuestionsProgress(
    entry: TranscriptEntry,
    formVariant: LearningRecordFormVariant
): { answered: number; total: number } {
    if (formVariant === 'funnel') {
        return {
            answered: countFunnelFieldsAnswered(entry),
            total: FUNNEL_FORM_FIELD_TOTAL
        };
    }
    return {
        answered: countAnsweredReflections(entry),
        total: reflectionSlotsTotal()
    };
}

function QuestionsAnsweredBadge({
    answered,
    total
}: {
    answered: number;
    total: number;
}) {
    const tier = funnelCompletionTier(answered, total);
    const bg = CONFIDENCE_LEVEL_SOLID[tier - 1];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md border border-border/60 px-2.5 py-0.5 text-xs font-medium text-black',
                bg
            )}
        >
            {answered} / {total}
        </span>
    );
}

function SortableColumnHeader({
    label,
    column,
    tableSort,
    onSortColumn,
    className
}: {
    label: string;
    column: SortColumn;
    tableSort: TableSort;
    onSortColumn: (column: SortColumn) => void;
    className?: string;
}) {
    const isActive = tableSort.column === column;
    const SortIcon = !isActive
        ? ChevronsUpDown
        : tableSort.direction === 'asc'
          ? ChevronUp
          : ChevronDown;

    return (
        <TableHead className={className}>
            <button
                type="button"
                onClick={() => onSortColumn(column)}
                className={cn(
                    'inline-flex items-center gap-1 text-left text-sm transition-colors hover:text-foreground',
                    isActive ? 'font-medium text-foreground' : 'font-semibold text-muted-foreground'
                )}
            >
                {label}
                <SortIcon
                    size={14}
                    className={cn(
                        'shrink-0',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                    aria-hidden
                />
            </button>
        </TableHead>
    );
}

interface SavedEntriesSectionProps {
    entries: TranscriptEntry[];
    sortedEntries: TranscriptEntry[];
    entryPath: string;
    formVariant: LearningRecordFormVariant;
    sectionHeading: ReactNode;
    headerAction?: ReactNode;
    emptyState: { title: string; description: string };
    tableSort: TableSort;
    onSortColumn: (column: SortColumn) => void;
    onDeleteRequest: (entry: TranscriptEntry) => void;
    onDownloadEntry: (entry: TranscriptEntry) => void;
    downloadingEntryId: string | null;
    isDownloadBusy: boolean;
}

function SavedEntriesSection({
    entries,
    sortedEntries,
    entryPath,
    formVariant,
    sectionHeading,
    headerAction,
    emptyState,
    tableSort,
    onSortColumn,
    onDeleteRequest,
    onDownloadEntry,
    downloadingEntryId,
    isDownloadBusy
}: SavedEntriesSectionProps) {
    return (
        <section className="flex min-h-0 flex-col">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>{sectionHeading}</div>
                {headerAction}
            </div>

            <Separator className="mb-6" />

            {entries.length === 0 ? (
                <EmptyState
                    className="border-dashed bg-card/60 shadow-none"
                    title={emptyState.title}
                    description={emptyState.description}
                />
            ) : (
                <Card
                    data-slot="transcript-saved-entries-table"
                    className="overflow-hidden p-0 shadow-sm"
                >
                    <CardContent className="p-0">
                        <Table className="table-fixed">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableColumnHeader
                                        label="Program"
                                        column="program"
                                        tableSort={tableSort}
                                        onSortColumn={onSortColumn}
                                        className="w-[min(28%,14rem)] pl-6"
                                    />
                                    <SortableColumnHeader
                                        label="Completed"
                                        column="completed"
                                        tableSort={tableSort}
                                        onSortColumn={onSortColumn}
                                        className="hidden w-[200px] sm:table-cell"
                                    />
                                    <SortableColumnHeader
                                        label="Steps done"
                                        column="questions"
                                        tableSort={tableSort}
                                        onSortColumn={onSortColumn}
                                        className="hidden w-[200px] md:table-cell"
                                    />
                                    <SortableColumnHeader
                                        label="Added on"
                                        column="addedOn"
                                        tableSort={tableSort}
                                        onSortColumn={onSortColumn}
                                        className="hidden w-[200px] lg:table-cell"
                                    />
                                    <TableHead className="min-w-[9.5rem] pr-6 text-right font-semibold text-foreground">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEntries.map((entry) => {
                                    const editHref = `${entryPath}?edit=${encodeURIComponent(entry.id)}`;
                                    const { answered, total } = getEntryQuestionsProgress(
                                        entry,
                                        formVariant
                                    );
                                    const isDownloading = downloadingEntryId === entry.id;

                                    return (
                                        <TableRow
                                            key={entry.id}
                                            data-slot="transcript-saved-entry-row"
                                            className="group cursor-pointer hover:bg-muted/30"
                                        >
                                            <Button
                                                asChild
                                                variant="ghost"
                                                className="contents h-auto border-0 bg-transparent p-0 font-normal shadow-none hover:bg-transparent"
                                            >
                                                <Link to={editHref} className="contents">
                                                    <TableCell className="max-w-[14rem] align-middle pl-6 font-medium text-foreground">
                                                        <span className="font-medium group-hover:underline">
                                                            {getEntryDisplayTitle(
                                                                entry.programName,
                                                                EMPTY_FIELD_LABEL
                                                            )}
                                                        </span>
                                                        <p className="mt-1 text-xs font-normal text-muted-foreground sm:hidden">
                                                            Completed{' '}
                                                            {formatProgramCompletedDate(entry)}
                                                        </p>
                                                        <div className="mt-3 md:hidden">
                                                            <QuestionsAnsweredBadge
                                                                answered={answered}
                                                                total={total}
                                                            />
                                                        </div>
                                                        <p className="mt-2 text-xs text-muted-foreground lg:hidden">
                                                            Added on{' '}
                                                            {formatSavedOn(entry.createdAt)}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="hidden w-[200px] align-middle text-foreground sm:table-cell">
                                                        {formatProgramCompletedDate(entry)}
                                                    </TableCell>
                                                    <TableCell className="hidden w-[200px] align-middle md:table-cell">
                                                        <QuestionsAnsweredBadge
                                                            answered={answered}
                                                            total={total}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="hidden w-[200px] align-middle text-foreground lg:table-cell">
                                                        {formatSavedOn(entry.createdAt)}
                                                    </TableCell>
                                                </Link>
                                            </Button>
                                            <TableCell className="relative z-10 align-middle pr-6">
                                                <div
                                                    className="flex items-center justify-end gap-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                    }}
                                                >
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-10 shrink-0 gap-1.5 px-2"
                                                        aria-label="Save achievement as PDF"
                                                        disabled={isDownloading || isDownloadBusy}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            onDownloadEntry(entry);
                                                        }}
                                                    >
                                                        {isDownloading ? (
                                                            <Loader2
                                                                className="size-4 animate-spin"
                                                                aria-hidden
                                                            />
                                                        ) : (
                                                            <Download size={16} aria-hidden />
                                                        )}
                                                        <span className="text-xs font-medium">
                                                            Save as PDF
                                                        </span>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className={cn(
                                                            'h-10 shrink-0 gap-1.5 px-2',
                                                            'hover:bg-destructive/10 hover:text-destructive'
                                                        )}
                                                        aria-label="Delete achievement"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            onDeleteRequest(entry);
                                                        }}
                                                    >
                                                        <Trash2 size={16} aria-hidden />
                                                        <span className="text-xs font-medium">
                                                            Delete
                                                        </span>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </section>
    );
}

export default function DigitalTranscriptHome() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = getDigitalTranscriptBasePath(pathname);
    setDigitalTranscriptStorageContext(base);
    const formVariant = getLearningRecordFormVariant(pathname);
    const isFunnel = formVariant === 'funnel';
    const entryPath = `${base}/entry`;
    const { entries, hydrated, hasDraft, deleteCommittedEntry } =
        useTranscriptDraft();
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const [deleteTarget, setDeleteTarget] = useState<TranscriptEntry | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportRows, setExportRows] = useState<TranscriptEntry[]>([]);
    const [exportActive, setExportActive] = useState(false);
    const [downloadingEntryId, setDownloadingEntryId] = useState<string | null>(null);
    const [viewAllOpen, setViewAllOpen] = useState(false);
    const [tableSort, setTableSort] = useState<TableSort>(readTableSortFromSession);
    const exportRootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        writeTableSortToSession(tableSort);
    }, [tableSort]);

    const sortedEntries = useMemo(
        () => sortTranscriptEntries(entries, tableSort, formVariant),
        [entries, tableSort, formVariant]
    );

    const isDownloadBusy = downloadingEntryId !== null;

    const handleSortColumn = useCallback((column: SortColumn) => {
        setTableSort((current) => toggleTableSort(current, column));
    }, []);

    const waitForExportPaint = useCallback(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
    }, []);

    const handleDownloadEntry = useCallback(
        async (entry: TranscriptEntry) => {
            if (isDownloadBusy) return;

            setDownloadingEntryId(entry.id);
            flushSync(() => {
                setExportActive(true);
                setExportRows([entry]);
            });

            try {
                await waitForExportPaint();

                const root = exportRootRef.current;
                if (!root) {
                    throw new Error('Export content not ready');
                }

                await downloadLearningRecordPdf(
                    root,
                    learningRecordPdfFilename(residentName)
                );
                toast.success('Your record was saved as a PDF');
            } catch (err) {
                console.error('Learning record PDF export failed:', err);
                toast.error('Could not save PDF. Please try again.');
            } finally {
                setExportActive(false);
                setDownloadingEntryId(null);
            }
        },
        [isDownloadBusy, residentName, waitForExportPaint]
    );

    const handleConfirmDelete = useCallback(() => {
        if (!deleteTarget || isDeleting) return;

        setIsDeleting(true);
        void deleteCommittedEntry(deleteTarget.id).finally(() => {
            setIsDeleting(false);
            setDeleteTarget(null);
        });
    }, [deleteCommittedEntry, deleteTarget, isDeleting]);

    const handleStartNewClick = useCallback(() => {
        setViewAllOpen(false);
        navigate(`${entryPath}?intent=new`);
    }, [entryPath, navigate]);

    if (!hydrated) {
        return (
            <DigitalTranscriptShell>
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                    <p className="text-sm font-medium">Loading your record…</p>
                </div>
            </DigitalTranscriptShell>
        );
    }

    const viewAllAchievementsButton =
        entries.length > 0 ? (
            <Button
                type="button"
                variant="outline"
                size={LEARNING_RECORD_BUTTON_SIZE}
                className={cn(learningRecordOutlineButtonClassName, 'sm:min-w-[11rem]')}
                onClick={() => setViewAllOpen(true)}
            >
                <Eye className="size-4" aria-hidden />
                View all achievements
            </Button>
        ) : null;

    const primaryCtaLabel = entries.length === 0 ? 'Start logging' : 'Add achievement';

    const cardTitle =
        entries.length === 0 && !hasDraft ? 'Start logging' : 'Build your Achievements Record';

    const deleteProgramName = getEntryDisplayTitle(deleteTarget?.programName, 'Untitled');

    return (
        <DigitalTranscriptShell variant="wide">
            {exportActive &&
                createPortal(
                    <div
                        data-slot="learning-record-pdf-capture"
                        aria-hidden
                        className="pointer-events-none fixed top-0 left-0 w-[8.5in] max-w-[816px] overflow-visible bg-background"
                        style={{ zIndex: -1, clipPath: 'inset(50%)' }}
                    >
                        <LearningRecordExportContent
                            ref={exportRootRef}
                            rows={exportRows}
                            residentName={residentName}
                            filledSectionsOnly
                            documentVariant={isFunnel ? 'funnel' : 'default'}
                        />
                    </div>,
                    document.body
                )}
            {isFunnel ? (
                <>
                    <PageHeader
                        className="mb-2 flex-col items-start gap-0 sm:flex-row"
                        title="Build your Learning Record"
                        subtitle={FUNNEL_SUBTITLE}
                    />
                    <PrintShareHelpLink className="mb-8" />

                    <SavedEntriesSection
                        entries={entries}
                        sortedEntries={sortedEntries}
                        entryPath={entryPath}
                        formVariant={formVariant}
                        sectionHeading={
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                {savedHereLabel(entries.length)}
                            </h2>
                        }
                        headerAction={
                            <div className="flex items-center gap-2 sm:ml-auto">
                                {viewAllAchievementsButton}
                                <Button
                                    type="button"
                                    variant="default"
                                    size={LEARNING_RECORD_BUTTON_SIZE}
                                    onClick={handleStartNewClick}
                                    className={cn('gap-1.5', primaryCtaClassName)}
                                >
                                    <Plus className="size-4" aria-hidden />
                                    Add achievement
                                </Button>
                            </div>
                        }
                        tableSort={tableSort}
                        onSortColumn={handleSortColumn}
                        emptyState={{
                            title: 'No achievements added yet',
                            description:
                                "Click 'Add achievement' to document your first program, skill, or learning. Your record builds from here."
                        }}
                        onDeleteRequest={setDeleteTarget}
                        onDownloadEntry={(entry) => void handleDownloadEntry(entry)}
                        downloadingEntryId={downloadingEntryId}
                        isDownloadBusy={isDownloadBusy}
                    />
                </>
            ) : (
                <>
                    <PageHeader
                        className="mb-2 flex-col items-start gap-0 sm:flex-row"
                        title="Learning Record"
                        subtitle="Write down what you finished and the skills you built. Your answers are saved here as you go. Tap Done when one achievement feels complete."
                    />
                    <PrintShareHelpLink className="mb-8" />

                    <Card className="mb-6 overflow-hidden p-0">
                        <div className="flex flex-col md:flex-row">
                            <div className="min-w-0 flex-1">
                                <CardHeader className="space-y-1 pb-5">
                                    <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                                        {cardTitle}
                                    </CardTitle>
                                    <CardDescription className="text-base leading-relaxed">
                                        {hasDraft ? (
                                            <>
                                                You have work in progress in the editor. Continue where you left
                                                off, or add a new program achievement.
                                            </>
                                        ) : entries.length === 0 ? (
                                            <>
                                                Open the editor and fill in what you did. Nothing appears on
                                                this list until you tap Done.
                                            </>
                                        ) : (
                                            <>
                                                You have saved {entries.length}{' '}
                                                {entries.length === 1 ? 'achievement' : 'achievements'}. Add
                                                another anytime.
                                            </>
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
                                    {hasDraft ? (
                                        <>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size={LEARNING_RECORD_BUTTON_SIZE}
                                                onClick={handleStartNewClick}
                                                className={primaryCtaClassName}
                                            >
                                                Add
                                            </Button>
                                            <Button
                                                asChild
                                                variant="secondary"
                                                size={LEARNING_RECORD_BUTTON_SIZE}
                                                className="sm:min-w-[11rem]"
                                            >
                                                <Link to={entryPath}>Edit</Link>
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            {entries.length > 0 && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="default"
                                                        size={LEARNING_RECORD_BUTTON_SIZE}
                                                        onClick={handleStartNewClick}
                                                        className={primaryCtaClassName}
                                                    >
                                                        {primaryCtaLabel}
                                                    </Button>
                                                    <Button
                                                        asChild
                                                        variant="secondary"
                                                        size={LEARNING_RECORD_BUTTON_SIZE}
                                                        className="sm:min-w-[8rem]"
                                                    >
                                                        <Link to={entryPath}>Edit</Link>
                                                    </Button>
                                                </>
                                            )}
                                            {entries.length === 0 && (
                                                <Button
                                                    type="button"
                                                    variant="default"
                                                    size={LEARNING_RECORD_BUTTON_SIZE}
                                                    onClick={handleStartNewClick}
                                                    className={primaryCtaClassName}
                                                >
                                                    {primaryCtaLabel}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </div>
                            <div className="flex shrink-0 flex-col justify-center border-t border-border bg-muted/40 p-5 md:w-[min(100%,20rem)] md:border-l md:border-t-0">
                                <div
                                    role="img"
                                    aria-label="Sample achievement log: card with program name, date, and reflection answers"
                                    className="relative mx-auto h-[11.5rem] w-full max-w-[15.5rem] min-w-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm"
                                >
                                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                                        <div
                                            className="absolute left-1/2 top-1/2 w-[42rem] max-w-none origin-center will-change-transform"
                                            style={{
                                                transform: 'translate(-50%, -50%) scale(0.44)'
                                            }}
                                        >
                                            <TranscriptResumePreview
                                                variant="paper"
                                                hideReadiness
                                                source={ACHIEVEMENT_LOG_THUMBNAIL_SAMPLE}
                                                className="w-full max-w-none border-0 shadow-md ring-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <SavedEntriesSection
                        entries={entries}
                        sortedEntries={sortedEntries}
                        entryPath={entryPath}
                        formVariant={formVariant}
                        sectionHeading={
                            <>
                                <DigitalTranscriptEyebrow>Saved entries</DigitalTranscriptEyebrow>
                                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                    Saved here
                                </h2>
                            </>
                        }
                        headerAction={
                            entries.length > 0 ? (
                                <div className="flex flex-col items-start gap-2 sm:ml-auto sm:items-end">
                                    {viewAllAchievementsButton}
                                    <p className="text-sm text-muted-foreground">
                                        {entries.length}{' '}
                                        {entries.length === 1 ? 'achievement' : 'achievements'}
                                    </p>
                                </div>
                            ) : undefined
                        }
                        tableSort={tableSort}
                        onSortColumn={handleSortColumn}
                        emptyState={{
                            title: 'Nothing saved yet',
                            description:
                                'When you finish editing and tap Done, your achievement appears here.'
                        }}
                        onDeleteRequest={setDeleteTarget}
                        onDownloadEntry={(entry) => void handleDownloadEntry(entry)}
                        downloadingEntryId={downloadingEntryId}
                        isDownloadBusy={isDownloadBusy}
                    />
                </>
            )}
            <ViewAllAchievementsSheet
                open={viewAllOpen}
                onOpenChange={setViewAllOpen}
                entries={sortedEntries}
                residentName={residentName}
                documentVariant={isFunnel ? 'funnel' : 'default'}
            />
            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete this achievement?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove <strong>{deleteProgramName}</strong> from your
                            learning record. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size={LEARNING_RECORD_BUTTON_SIZE}
                            className={learningRecordOutlineButtonClassName}
                            disabled={isDeleting}
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size={LEARNING_RECORD_BUTTON_SIZE}
                            disabled={isDeleting}
                            onClick={handleConfirmDelete}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                    Deleting…
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DigitalTranscriptShell>
    );
}
