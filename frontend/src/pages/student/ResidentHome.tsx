import { useLoaderData, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    OpenContentItem,
    HelpfulLink,
    HelpfulLinkAndSort,
    Library,
    FeatureAccess,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import TopContentList from '@/components/dashboard/TopContentList';
import { IncompleteEntryReminder } from '@/components/dashboard/IncompleteEntryReminder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, PenLine, Plus, Star, X } from 'lucide-react';
import { EmptyState } from '@/components/shared';
import { useTourContext } from '@/contexts/useTourContext';
import { targetToStepIndexMap } from '@/contexts/tourState';
import { decodeHtmlEntities } from '@/lib/decodeHtmlEntities';
import { clickableProps } from '@/lib/a11y';
import { toExternalUrl } from '@/lib/utils';
import {
    DIGITAL_TRANSCRIPT_BASE,
    DIGITAL_TRANSCRIPT_ENTRY_PATH,
    setDigitalTranscriptStorageContext
} from '@/pages/student/digital-transcript/digitalTranscriptRoutes';
import {
    LEARNING_RECORD_BUTTON_SIZE,
    learningRecordOutlineButtonClassName
} from '@/pages/student/digital-transcript/learningRecordButtons';
import {
    findIncompleteAchievementEntry,
    sortEntriesNewestFirst
} from '@/pages/student/digital-transcript/transcriptEntrySessionStorage';
import { entryIsComplete } from '@/pages/student/digital-transcript/learningRecordDocumentModel';
import { getLearningRecordFormVariant } from '@/pages/student/digital-transcript/learningRecordPrototypes';
import { learningRecordResidentDisplayName } from '@/pages/student/digital-transcript/learningRecordResidentName';
import { ViewAllAchievementsSheet } from '@/pages/student/digital-transcript/ViewAllAchievementsSheet';
import { PrintShareHelpLink } from '@/components/learning-record/PrintShareHelpLink';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ResidentHomeData {
    helpfulLinks: HelpfulLink[];
    topUserContent: OpenContentItem[];
    topFacilityContent: OpenContentItem[];
    favorites: OpenContentItem[];
}

export type ResidentHomeLearningState =
    | 'new'
    | 'returningWithIncomplete'
    | 'returningComplete';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const REFLECT_NUDGE_DAYS_THRESHOLD = 14;
const REFLECT_NUDGE_STORAGE_KEY = 'unlocked.resident-home.reflect-nudge.dismissed';
const LAST_HOME_VISIT_KEY = 'unlocked.resident-home.last-visit';

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function achievementCountWord(count: number): string {
    return count === 1 ? 'achievement' : 'achievements';
}

function detectLearningState(
    entries: TranscriptEntry[],
    inProgressEntryExists: boolean,
    formVariant: ReturnType<typeof getLearningRecordFormVariant>
): ResidentHomeLearningState {
    const savedCount = entries.filter((e) => entryIsComplete(e, formVariant)).length;
    if (inProgressEntryExists) return 'returningWithIncomplete';
    if (savedCount === 0) return 'new';
    return 'returningComplete';
}

function parsePreviewLearningState(
    raw: string | null
): ResidentHomeLearningState | undefined {
    if (raw === 'new') return 'new';
    if (raw === 'incomplete' || raw === 'resume') return 'returningWithIncomplete';
    if (raw === 'complete' || raw === 'returning') return 'returningComplete';
    return undefined;
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function FeaturedLibraryCard({
    library,
    onClick
}: {
    library: Library;
    onClick: () => void;
}) {
    const title = decodeHtmlEntities(library.title);
    const description = decodeHtmlEntities(library.description ?? '');
    return (
        <div {...clickableProps(onClick)} className="block cursor-pointer">
            <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                        {library.thumbnail_url ? (
                            <img
                                src={library.thumbnail_url}
                                alt={title}
                                className="size-12 rounded object-cover shrink-0"
                            />
                        ) : (
                            <div className="size-12 rounded bg-muted shrink-0" />
                        )}
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {title}
                        </h4>
                    </div>
                    <p className="caption-clamp">{description}</p>
                </CardContent>
            </Card>
        </div>
    );
}

function HelpfulLinkCard({ link }: { link: HelpfulLink }) {
    const title = decodeHtmlEntities(link.title);
    const description = decodeHtmlEntities(link.description ?? '');
    return (
        <a
            href={toExternalUrl(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 flex items-start gap-3">
                    <ExternalLink className="size-5 text-brand shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {title}
                        </h4>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {description}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </a>
    );
}

function FavoriteItem({ item }: { item: OpenContentItem }) {
    const navigate = useNavigate();
    const title = decodeHtmlEntities(item.title);

    const handleClick = () => {
        if (item.content_type === 'video') {
            navigate(`/viewer/videos/${item.content_id}`);
        } else if (item.content_type === 'library') {
            navigate(`/viewer/libraries/${item.content_id}`);
        } else {
            window.open(
                toExternalUrl(item.url),
                '_blank',
                'noopener,noreferrer'
            );
        }
    };

    return (
        <div
            {...clickableProps(handleClick)}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:shadow-md transition-shadow cursor-pointer"
        >
            {item.thumbnail_url ? (
                <img
                    src={item.thumbnail_url}
                    alt={title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded bg-muted shrink-0" />
            )}
            <p className="text-sm text-foreground truncate">{title}</p>
        </div>
    );
}

function RecentAchievementsPanel({
    totalCount,
    onExportClick,
    hasInProgressEntry = false
}: {
    totalCount: number;
    onExportClick: () => void;
    hasInProgressEntry?: boolean;
}) {
    return (
        <Card
            className="flex h-full min-h-0 flex-col border border-gray-200 p-0 shadow-sm dark:border-border lg:col-span-1"
            aria-label="Recent achievements"
        >
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-8">
                {totalCount === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <p className="text-sm text-muted-foreground">
                            {hasInProgressEntry
                                ? 'Once you finish your entry, it will show up here.'
                                : "You haven't added anything yet. What you add will show up here."}
                        </p>
                    </div>
                ) : (
                    <p
                        className="flex-1 text-center text-sm text-muted-foreground"
                        aria-label={`${totalCount} ${achievementCountWord(totalCount)} saved here`}
                    >
                        <span className="block text-5xl font-bold tabular-nums leading-none text-[#556830] dark:text-primary">
                            {totalCount}
                        </span>
                        <span className="mt-2 block font-semibold text-foreground">
                            {achievementCountWord(totalCount)} saved here
                        </span>
                    </p>
                )}
                {totalCount > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={onExportClick}
                    >
                        Save as PDF
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function ResidentHome() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const { topUserContent, topFacilityContent } =
        useLoaderData() as ResidentHomeData;
    const { tourState, setTourState } = useTourContext();
    const { entries, hasDraft, hydrated } = useTranscriptDraft();

    // --- Learning record state ---
    const [reflectNudgeDismissed, setReflectNudgeDismissed] = useState(() => {
        try {
            return localStorage.getItem(REFLECT_NUDGE_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });
    const [entrySessionTick, setEntrySessionTick] = useState(0);
    const [exportSheetOpen, setExportSheetOpen] = useState(false);
    const [incompleteReminderDismissedId, setIncompleteReminderDismissedId] =
        useState<string | null>(null);

    const learningRecordFormVariant = getLearningRecordFormVariant(DIGITAL_TRANSCRIPT_BASE);
    const residentName = learningRecordResidentDisplayName(user);

    const { data: featured } = useSWR<ServerResponseMany<Library>>(
        '/api/libraries?visibility=featured&order_by=created_at'
    );
    const { data: favorites } = useSWR<ServerResponseMany<OpenContentItem>>(
        '/api/open-content/favorite-groupings'
    );
    const { data: helpfulLinks } =
        useSWR<ServerResponseOne<HelpfulLinkAndSort>>('/api/helpful-links');

    // --- Preview params (design / QA) ---
    const previewLearningState = parsePreviewLearningState(
        searchParams.get('homeState')
    );
    const showReflectNudge =
        searchParams.get('reflectNudge') === '1' ||
        searchParams.get('reflectNudge') === 'true';

    const daysSinceLastVisitOverride = searchParams.get('daysSinceLastVisit');
    const daysSinceLastVisit = useMemo(() => {
        if (daysSinceLastVisitOverride !== null) {
            const parsed = Number(daysSinceLastVisitOverride);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        try {
            const raw = localStorage.getItem(LAST_HOME_VISIT_KEY);
            if (!raw) return 0;
            const last = Date.parse(raw);
            if (Number.isNaN(last)) return 0;
            return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
        } catch {
            return undefined;
        }
    }, [daysSinceLastVisitOverride]);

    useEffect(() => {
        setDigitalTranscriptStorageContext(DIGITAL_TRANSCRIPT_BASE);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(LAST_HOME_VISIT_KEY, new Date().toISOString());
        } catch {
            /* ignore — last-visit used for reflect nudge on the next home load */
        }
    }, []);

    useEffect(() => {
        const bump = () => setEntrySessionTick((n) => n + 1);
        window.addEventListener('transcript-entry-session-updated', bump);
        return () =>
            window.removeEventListener('transcript-entry-session-updated', bump);
    }, []);

    useEffect(() => {
        if (tourState.tourActive && tourState.target === '#navigate-homepage') {
            setTourState({
                stepIndex: targetToStepIndexMap['#popular-content'],
                target: '#popular-content'
            });
        } else if (tourState.tourActive && tourState.stepIndex !== 1) {
            setTourState({
                run: true,
                stepIndex: 0,
                target: '#resident-home'
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourState.tourActive]);

    const dismissReflectNudge = useCallback(() => {
        setReflectNudgeDismissed(true);
        try {
            localStorage.setItem(REFLECT_NUDGE_STORAGE_KEY, '1');
        } catch {
            /* ignore */
        }
    }, []);

    const learningRecordEnabled = user
        ? hasFeature(user, FeatureAccess.LearningRecordAccess)
        : false;

    const incompleteEntry = useMemo(() => {
        return findIncompleteAchievementEntry(entries, learningRecordFormVariant);
    }, [hasDraft, entries, entrySessionTick, learningRecordFormVariant]);

    const inProgressEntryExists = incompleteEntry !== null;

    const resumeHref = incompleteEntry
        ? `${DIGITAL_TRANSCRIPT_ENTRY_PATH}?edit=${encodeURIComponent(incompleteEntry.id)}`
        : DIGITAL_TRANSCRIPT_ENTRY_PATH;

    const inProgressEntryReminder = incompleteEntry
        ? { id: incompleteEntry.id, title: incompleteEntry.programName, resumeHref }
        : null;

    const incompleteEntryReminderDismissed =
        inProgressEntryExists &&
        inProgressEntryReminder !== null &&
        incompleteReminderDismissedId === inProgressEntryReminder.id;

    const dismissIncompleteEntryReminder = useCallback(() => {
        if (!inProgressEntryReminder) return;
        setIncompleteReminderDismissedId(inProgressEntryReminder.id);
    }, [inProgressEntryReminder]);

    const savedEntries = useMemo(
        () => entries.filter((e) => entryIsComplete(e, learningRecordFormVariant)),
        [entries, learningRecordFormVariant]
    );
    const achievementsNewestFirst = useMemo(
        () => sortEntriesNewestFirst(savedEntries),
        [savedEntries]
    );

    const isNewResident = savedEntries.length === 0 && !inProgressEntryExists;

    const detectedState = detectLearningState(
        entries,
        inProgressEntryExists,
        learningRecordFormVariant
    );
    const learningState = previewLearningState ?? detectedState;
    const heroIsFirstTime = previewLearningState === 'new' || isNewResident;
    const heroCtaLabel = heroIsFirstTime ? 'Start my record' : 'Add an achievement';

    const reflectNudgeVisible =
        !reflectNudgeDismissed &&
        learningState !== 'new' &&
        !isNewResident &&
        (showReflectNudge ||
            (typeof daysSinceLastVisit === 'number' &&
                daysSinceLastVisit >= REFLECT_NUDGE_DAYS_THRESHOLD));

    const featuredItems = featured?.data ?? [];
    const favoriteItems = favorites?.data ?? [];
    const links = helpfulLinks?.data?.helpful_links ?? [];

    if (!user || !hydrated) return null;

    return (
        <div className="bg-muted min-h-screen p-6" id="resident-home">
            <div className="max-w-7xl mx-auto flex gap-6">
                <div className="flex-1 space-y-8">
                    {/* ── Reflect nudge ── */}
                    {learningRecordEnabled && reflectNudgeVisible ? (
                        <Alert className="border-[#556830]/30 bg-[#556830]/5">
                            <PenLine className="text-[#556830] dark:text-primary" aria-hidden />
                            <AlertTitle className="text-foreground">
                                Catch up your learning record
                            </AlertTitle>
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    It has been a while since you logged an achievement. Add
                                    anything you have completed recently so your record stays
                                    current.
                                </span>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className={learningRecordOutlineButtonClassName}
                                    >
                                        <a href={`${DIGITAL_TRANSCRIPT_ENTRY_PATH}?intent=new`}>
                                            Log achievements
                                        </a>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0"
                                        aria-label="Dismiss reminder"
                                        onClick={dismissReflectNudge}
                                    >
                                        <X className="size-4" aria-hidden />
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {/* ── Incomplete-entry banner ── */}
                    {learningRecordEnabled ? (
                        <IncompleteEntryReminder
                            hasInProgressEntry={inProgressEntryExists}
                            entry={inProgressEntryReminder}
                            dismissed={incompleteEntryReminderDismissed}
                            onDismiss={dismissIncompleteEntryReminder}
                        />
                    ) : null}

                    {/* ── Learning Record ── */}
                    {learningRecordEnabled ? (
                        <section
                            aria-labelledby="home-learning-records-heading"
                            className="space-y-3"
                        >
                            <div>
                                <h2
                                    id="home-learning-records-heading"
                                    className="section-heading"
                                >
                                    Learning Record
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Keep track of what you&apos;ve learned.
                                </p>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                                <Card className="border-0 bg-[#556830] p-4 text-white shadow-sm dark:bg-[#556830] lg:col-span-2">
                                    <CardContent className="space-y-4 p-4">
                                        <div className="space-y-3">
                                            <h3 className="text-2xl font-bold leading-tight">
                                                {heroIsFirstTime
                                                    ? 'Start your learning record'
                                                    : 'Log a new achievement'}
                                            </h3>
                                            <p className="max-w-xl text-sm leading-relaxed text-white/80">
                                                Write down a class, program, or skill you finished.
                                                Your answers are saved here as you go. Nothing
                                                leaves this app unless you choose to print or share
                                                it.
                                            </p>
                                            <PrintShareHelpLink variant="onDark" />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                                            <Button
                                                asChild
                                                size={LEARNING_RECORD_BUTTON_SIZE}
                                                className="gap-1.5 bg-white px-4 text-[#556830] hover:bg-white/90"
                                            >
                                                <a href={`${DIGITAL_TRANSCRIPT_ENTRY_PATH}?intent=new`}>
                                                    {!heroIsFirstTime ? (
                                                        <Plus className="size-4" aria-hidden />
                                                    ) : null}
                                                    {heroCtaLabel}
                                                </a>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                                <RecentAchievementsPanel
                                    totalCount={savedEntries.length}
                                    hasInProgressEntry={inProgressEntryExists}
                                    onExportClick={() => setExportSheetOpen(true)}
                                />
                            </div>
                        </section>
                    ) : null}

                    {/* ── Featured Content ── */}
                    {featuredItems.length > 0 && (
                        <section>
                            <h2 className="section-heading">Featured Content</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {featuredItems.map((lib) => (
                                    <FeaturedLibraryCard
                                        key={`${lib.id}-${lib.open_content_provider_id}`}
                                        library={lib}
                                        onClick={() =>
                                            navigate(`/viewer/libraries/${lib.id}`)
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Top Content ── */}
                    <section>
                        <h2 className="section-heading">
                            Pick Up Where You Left Off
                        </h2>
                        <div
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                            id="end-tour"
                        >
                            <div id="top-content">
                                <TopContentList
                                    heading="Your Top Content"
                                    items={topUserContent}
                                    onViewAll={() => navigate('/knowledge-center')}
                                />
                            </div>
                            <div id="popular-content">
                                <TopContentList
                                    heading="Popular Content"
                                    items={topFacilityContent}
                                    onViewAll={() => navigate('/knowledge-center')}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Helpful Links ── */}
                    {links.length > 0 && (
                        <section>
                            <h2 className="section-heading">Helpful Links</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {links.map((link) => (
                                    <HelpfulLinkCard
                                        key={`${link.id}-${link.url}`}
                                        link={link}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* ── Favorites sidebar ── */}
                <aside className="hidden xl:block w-80 shrink-0 space-y-6 sticky top-6 self-start">
                    <div className="bg-card rounded-lg border border-border p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Star className="size-5 text-brand-gold" />
                            <h2 className="text-lg font-semibold text-foreground">
                                Favorites
                            </h2>
                        </div>
                        {favoriteItems.length > 0 ? (
                            <div className="space-y-2">
                                {favoriteItems.map((item) => (
                                    <FavoriteItem
                                        key={`${item.content_id}-${item.url}`}
                                        item={item}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No Favorites Yet"
                                description="Content you favorite will appear here for quick access."
                            />
                        )}
                    </div>
                </aside>
            </div>

            {learningRecordEnabled ? (
                <ViewAllAchievementsSheet
                    open={exportSheetOpen}
                    onOpenChange={setExportSheetOpen}
                    entries={achievementsNewestFirst}
                    residentName={residentName}
                    documentVariant={
                        learningRecordFormVariant === 'funnel' ? 'funnel' : 'default'
                    }
                />
            ) : null}
        </div>
    );
}
