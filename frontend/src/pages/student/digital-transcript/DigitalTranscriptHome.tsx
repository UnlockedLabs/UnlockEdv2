import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { ConfirmDialog, EmptyState, PageHeader } from '@/components/shared';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import type { TranscriptEntry } from '@/types/digital-transcript';
import {
    countAnsweredReflections,
    reflectionSlotsTotal
} from '@/pages/student/digital-transcript/learningRecordDocumentModel';
import { getDigitalTranscriptBasePath, setDigitalTranscriptStorageContext } from './digitalTranscriptRoutes';
import { getLearningRecordFormVariant } from './learningRecordPrototypes';
import { DigitalTranscriptEyebrow, DigitalTranscriptShell } from './DigitalTranscriptShell';
import { TranscriptResumePreview } from './TranscriptResumePreview';

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
    oneSentence: 'A program that helped me believe I could finish what I started.'
};

const FUNNEL_SUBTITLE =
    "This is your personal record of the programs you've completed and the skills you've built. Each achievement you add is saved on this device — and when you're ready, you can export your record as a PDF to keep, share, or take with you.";

const primaryCtaClassName =
    'bg-[#556830] text-white shadow-sm hover:bg-[#203622] sm:min-w-[11rem]';

function formatProgramCompletedDate(entry: TranscriptEntry): string {
    if (!entry.completionDate.trim()) return '—';
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

function savedOnDeviceLabel(count: number): string {
    const word = count === 1 ? 'achievement' : 'achievements';
    return `You have ${count} ${word} saved on this device`;
}

function ReadinessCell({ entry }: { entry: TranscriptEntry }) {
    const filled = countAnsweredReflections(entry);
    const total = reflectionSlotsTotal();
    const pct = Math.round((filled / total) * 100);
    return (
        <div className="flex w-full max-w-[4.5rem] flex-col gap-1">
            <span className="text-xs font-medium tabular-nums text-foreground">
                {filled}/{total}
            </span>
            <div
                className="h-1 w-full max-w-[3.25rem] overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${filled} of ${total} reflections`}
            >
                <div
                    className="h-full rounded-full bg-primary/45 transition-[width] dark:bg-primary/50"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

interface SavedEntriesSectionProps {
    entries: TranscriptEntry[];
    entriesNewestFirst: TranscriptEntry[];
    entryPath: string;
    sectionHeading: ReactNode;
    headerAction?: ReactNode;
    emptyState: { title: string; description: string };
    onDeleteRequest: (entry: TranscriptEntry) => void;
}

function SavedEntriesSection({
    entries,
    entriesNewestFirst,
    entryPath,
    sectionHeading,
    headerAction,
    emptyState,
    onDeleteRequest
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
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[min(28%,14rem)] pl-6 font-semibold text-foreground">
                                        Program
                                    </TableHead>
                                    <TableHead className="hidden w-[9rem] font-semibold text-foreground sm:table-cell">
                                        Completed
                                    </TableHead>
                                    <TableHead className="hidden w-[4.5rem] font-semibold text-foreground md:table-cell">
                                        Readiness
                                    </TableHead>
                                    <TableHead className="hidden w-[7.5rem] font-semibold text-foreground lg:table-cell">
                                        Logged
                                    </TableHead>
                                    <TableHead className="w-[4.5rem] pr-6 text-right font-semibold text-foreground">
                                        <span className="sr-only">Edit</span>
                                    </TableHead>
                                    <TableHead className="w-[5.5rem] pr-6 text-right font-semibold text-foreground">
                                        <span className="sr-only">Delete</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entriesNewestFirst.map((entry) => (
                                    <TableRow
                                        key={entry.id}
                                        data-slot="transcript-saved-entry-row"
                                    >
                                        <TableCell className="max-w-[14rem] pl-6 align-top font-medium text-foreground">
                                            <div className="font-medium">
                                                {entry.programName.trim() || '—'}
                                            </div>
                                            <p className="mt-1 text-xs font-normal text-muted-foreground sm:hidden">
                                                Completed {formatProgramCompletedDate(entry)}
                                            </p>
                                            <div className="mt-3 md:hidden">
                                                <ReadinessCell entry={entry} />
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground lg:hidden">
                                                Logged {formatSavedOn(entry.createdAt)}
                                            </p>
                                        </TableCell>
                                        <TableCell className="hidden align-top text-muted-foreground sm:table-cell">
                                            {formatProgramCompletedDate(entry)}
                                        </TableCell>
                                        <TableCell className="hidden w-[4.5rem] align-top md:table-cell">
                                            <ReadinessCell entry={entry} />
                                        </TableCell>
                                        <TableCell className="hidden align-top text-muted-foreground lg:table-cell">
                                            {formatSavedOn(entry.createdAt)}
                                        </TableCell>
                                        <TableCell className="align-top pr-6 text-right">
                                            <Button variant="outline" size="sm" className="shrink-0" asChild>
                                                <Link
                                                    to={`${entryPath}?edit=${encodeURIComponent(entry.id)}`}
                                                >
                                                    Edit
                                                </Link>
                                            </Button>
                                        </TableCell>
                                        <TableCell className="align-top pr-6 text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={() => onDeleteRequest(entry)}
                                            >
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
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
    const { entries, hydrated, hasDraft, deleteCommittedEntry } = useTranscriptDraft();
    const [deleteTarget, setDeleteTarget] = useState<TranscriptEntry | null>(null);

    const entriesNewestFirst = useMemo(
        () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [entries]
    );

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

    function handleStartNewClick() {
        navigate(`${entryPath}?intent=new`);
    }

    const primaryCtaLabel = entries.length === 0 ? 'Start logging' : 'Add achievement';

    const cardTitle =
        entries.length === 0 && !hasDraft ? 'Start logging' : 'Build your Achievements Record';

    return (
        <DigitalTranscriptShell variant="wide">
            {isFunnel ? (
                <>
                    <PageHeader
                        className="mb-8 flex-col items-start gap-0 sm:flex-row"
                        title="Build your Learning Record"
                        subtitle={FUNNEL_SUBTITLE}
                    />

                    <SavedEntriesSection
                        entries={entries}
                        entriesNewestFirst={entriesNewestFirst}
                        entryPath={entryPath}
                        sectionHeading={
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                {savedOnDeviceLabel(entries.length)}
                            </h2>
                        }
                        headerAction={
                            <Button
                                type="button"
                                variant="default"
                                size="lg"
                                onClick={handleStartNewClick}
                                className={primaryCtaClassName}
                            >
                                Add achievement
                            </Button>
                        }
                        emptyState={{
                            title: 'No achievements added yet',
                            description:
                                "Click 'Add achievement' to document your first program, skill, or learning. Your record builds from here."
                        }}
                        onDeleteRequest={setDeleteTarget}
                    />
                </>
            ) : (
                <>
                    <PageHeader
                        className="mb-8 flex-col items-start gap-0 sm:flex-row"
                        title="Learning Record"
                        subtitle="Build your transcript-style record on the page—it saves as you go. Tap Done when one achievement feels complete. For now, everything stays on this device."
                    />

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
                                                size="lg"
                                                onClick={handleStartNewClick}
                                                className={primaryCtaClassName}
                                            >
                                                Add
                                            </Button>
                                            <Button
                                                asChild
                                                variant="secondary"
                                                size="lg"
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
                                                        size="lg"
                                                        onClick={handleStartNewClick}
                                                        className={primaryCtaClassName}
                                                    >
                                                        {primaryCtaLabel}
                                                    </Button>
                                                    <Button
                                                        asChild
                                                        variant="secondary"
                                                        size="lg"
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
                                                    size="lg"
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
                        entriesNewestFirst={entriesNewestFirst}
                        entryPath={entryPath}
                        sectionHeading={
                            <>
                                <DigitalTranscriptEyebrow>Saved entries</DigitalTranscriptEyebrow>
                                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                    On this device
                                </h2>
                            </>
                        }
                        headerAction={
                            entries.length > 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {entries.length}{' '}
                                    {entries.length === 1 ? 'achievement' : 'achievements'}
                                </p>
                            ) : undefined
                        }
                        emptyState={{
                            title: 'Nothing saved yet',
                            description:
                                'When you finish editing and tap Done, your achievement appears here.'
                        }}
                        onDeleteRequest={setDeleteTarget}
                    />
                </>
            )}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Remove this achievement?"
                description={
                    deleteTarget
                        ? `“${deleteTarget.programName.trim() || 'Untitled'}” will be removed from this device. This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="destructive"
                onConfirm={() => {
                    if (deleteTarget) {
                        deleteCommittedEntry(deleteTarget.id);
                    }
                    setDeleteTarget(null);
                }}
            />
        </DigitalTranscriptShell>
    );
}
