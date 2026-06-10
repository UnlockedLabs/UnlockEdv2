import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    PenLine,
    Plus,
    Star,
    X
} from 'lucide-react';
import { useAuth, hasFeature } from '@/auth/useAuth';
import {
    OpenContentItem,
    HelpfulLink,
    FeatureAccess,
    User,
    FacilityProgramClassEvent,
    ServerResponseMany
} from '@/types';
import type { TranscriptEntry } from '@/types/digital-transcript';
import ContinueLearningSection, {
    mapOpenContentToContinueItems
} from '@/components/dashboard/ContinueLearningSection';
import DiscoverContentSection, {
    buildDiscoverSectionData
} from '@/components/dashboard/DiscoverContentSection';
import { IncompleteEntryReminder } from '@/components/dashboard/IncompleteEntryReminder';
import UpcomingClassSessionCard from '@/components/dashboard/UpcomingClassSessionCard';
import { getDemoCalendarEvents } from '@/pages/learning/residentProgramsDemoData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTourContext } from '@/contexts/TourContext';
import { targetToStepIndexMap } from '@/components/UnlockEdTour';
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
// Scenario & state flags (preview + production defaults)
// -----------------------------------------------------------------------------

/** Scenario A: Knowledge Center + Learning Records. Scenario B: Learning Records only. */
export type ResidentHomeScenario =
    | 'knowledgeCenterAndLearningRecords'
    | 'learningRecordsOnly';

/**
 * Learning-record resident state (auto-detected from device storage unless overridden).
 * - `new`: no saved achievements, nothing in progress
 * - `returningWithIncomplete`: draft or unsynced session work exists
 * - `returningComplete`: has saved achievements, no in-progress entry
 */
export type ResidentHomeLearningState =
    | 'new'
    | 'returningWithIncomplete'
    | 'returningComplete';

/** Show reflect nudge when days since last visit meets or exceeds this threshold. */
export const REFLECT_NUDGE_DAYS_THRESHOLD = 14;

export interface ResidentHomeDashboardProps {
    /** Toggle Scenario A vs B for design previews. Defaults from Open Content feature access. */
    scenario?: ResidentHomeScenario;
    /** Override auto-detected learning-record state (dev / design preview). */
    previewLearningState?: ResidentHomeLearningState;
    /** Force reflect nudge visible (dev preview); production uses `daysSinceLastVisit`. */
    showReflectNudge?: boolean;
    /** Days since the resident last visited the homepage; drives reflect nudge when high enough. */
    daysSinceLastVisit?: number;
    /** Saved achievements (from `useTranscriptDraft`). */
    learningRecordEntries: TranscriptEntry[];
    /** True when draft or dirty entry session exists (`useTranscriptDraft` `hasDraft`). */
    hasIncompleteEntry: boolean;
    topUserContent: OpenContentItem[];
    topFacilityContent: OpenContentItem[];
    featuredLibraries: OpenContentItem[];
    favoriteItems: OpenContentItem[];
    helpfulLinks: HelpfulLink[];
}

const REFLECT_NUDGE_STORAGE_KEY = 'unlocked.resident-home.reflect-nudge.dismissed';

function achievementCountWord(count: number): string {
    return count === 1 ? 'achievement' : 'achievements';
}

/** "Monday, June 1" — date line above the greeting. */
function formatTodayDate(now = new Date()): string {
    return now.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

/** Time-aware greeting prefix to match the welcome-card pattern. */
function timeAwareGreeting(now = new Date()): string {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function resolveScenario(
    user: User,
    scenarioProp?: ResidentHomeScenario
): ResidentHomeScenario {
    if (scenarioProp) return scenarioProp;
    return hasFeature(user, FeatureAccess.OpenContentAccess)
        ? 'knowledgeCenterAndLearningRecords'
        : 'learningRecordsOnly';
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

function FavoriteItem({ item }: { item: OpenContentItem }) {
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:shadow-md transition-shadow"
        >
            {item.thumbnail_url ? (
                <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded bg-muted shrink-0" />
            )}
            <p className="text-sm text-foreground truncate">{item.title}</p>
        </a>
    );
}

function FavoritesPanel({ favoriteItems }: { favoriteItems: OpenContentItem[] }) {
    return (
        <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-200 bg-card p-6">
            <div className="mb-4 flex shrink-0 items-center gap-2">
                <Star className="size-5 shrink-0 text-[#F1B51C]" />
                <h2 className="text-lg font-semibold text-foreground">Favorites</h2>
            </div>
            {favoriteItems.length > 0 ? (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {favoriteItems.map((item) => (
                        <FavoriteItem
                            key={`${item.content_id}-${item.url}`}
                            item={item}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
                    <p className="text-lg font-medium text-foreground">No Favorites Yet</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Content you favorite will appear here for quick access.
                    </p>
                </div>
            )}
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

export function ResidentHomeDashboard({
    scenario: scenarioProp,
    previewLearningState,
    showReflectNudge = false,
    daysSinceLastVisit,
    learningRecordEntries,
    hasIncompleteEntry,
    topUserContent,
    topFacilityContent,
    featuredLibraries,
    favoriteItems,
    helpfulLinks
}: ResidentHomeDashboardProps) {
    const { user } = useAuth();
    const { tourState, setTourState } = useTourContext();
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

    useEffect(() => {
        setDigitalTranscriptStorageContext(DIGITAL_TRANSCRIPT_BASE);
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
    }, [tourState.tourActive, setTourState]);

    const dismissReflectNudge = useCallback(() => {
        setReflectNudgeDismissed(true);
        try {
            localStorage.setItem(REFLECT_NUDGE_STORAGE_KEY, '1');
        } catch {
            /* ignore */
        }
    }, []);

    // --- Resolved flags (used for layout + conditional rendering) ---
    const scenarioFlag = user ? resolveScenario(user, scenarioProp) : 'learningRecordsOnly';
    const knowledgeCenterEnabled = scenarioFlag === 'knowledgeCenterAndLearningRecords';
    const hasProgramsHub =
        !!user &&
        (hasFeature(user, FeatureAccess.ProgramAccess) ||
            hasFeature(user, FeatureAccess.ProviderAccess));

    const calendarStartDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    }, []);
    const calendarEndDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 56);
        return d.toISOString();
    }, []);

    const { data: calendarResp, isLoading: calendarLoading } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>
    >(
        user && hasProgramsHub
            ? `/api/student-calendar?start_dt=${calendarStartDate}&end_dt=${calendarEndDate}`
            : null
    );

    const calendarEvents = calendarResp?.data ?? [];
    const usingCalendarPreview = !calendarLoading && calendarEvents.length === 0;
    const calendarEventsForDisplay = useMemo(
        () => (usingCalendarPreview ? getDemoCalendarEvents() : calendarEvents),
        [usingCalendarPreview, calendarEvents]
    );

    const incompleteEntry = useMemo(() => {
        return findIncompleteAchievementEntry(learningRecordFormVariant);
    }, [hasIncompleteEntry, learningRecordEntries, entrySessionTick, learningRecordFormVariant]);

    /** True only when there is a real session row to resume (never an empty placeholder). */
    const inProgressEntryExists = incompleteEntry !== null;

    // --- In-progress entry reminder (Tier 1) ---
    /** True when an incomplete achievement entry exists on this device. */
    const hasInProgressEntry = inProgressEntryExists;

    const resumeHref = incompleteEntry
        ? `${DIGITAL_TRANSCRIPT_ENTRY_PATH}?edit=${encodeURIComponent(incompleteEntry.id)}`
        : DIGITAL_TRANSCRIPT_ENTRY_PATH;

    /**
     * Entry id, display title, and resume URL for the incomplete-entry banner.
     * Null when there is nothing to resume.
     */
    const inProgressEntryReminder = incompleteEntry
        ? {
              id: incompleteEntry.id,
              title: incompleteEntry.programName,
              resumeHref
          }
        : null;

    const incompleteEntryReminderDismissed =
        hasInProgressEntry &&
        inProgressEntryReminder !== null &&
        incompleteReminderDismissedId === inProgressEntryReminder.id;

    const dismissIncompleteEntryReminder = useCallback(() => {
        if (!inProgressEntryReminder) return;
        setIncompleteReminderDismissedId(inProgressEntryReminder.id);
    }, [inProgressEntryReminder]);

    const savedEntries = useMemo(
        () =>
            learningRecordEntries.filter((e) =>
                entryIsComplete(e, learningRecordFormVariant)
            ),
        [learningRecordEntries, learningRecordFormVariant]
    );
    const achievementsNewestFirst = useMemo(
        () => sortEntriesNewestFirst(savedEntries),
        [savedEntries]
    );
    const hasSavedRecords = savedEntries.length > 0;

    /** New resident: zero saved achievements and nothing in progress. */
    const isNewResident = !hasSavedRecords && !inProgressEntryExists;

    const detectedState = detectLearningState(
        learningRecordEntries,
        inProgressEntryExists,
        learningRecordFormVariant
    );
    const learningState = previewLearningState ?? detectedState;

    /** First-time vs returning shapes the hero copy/CTA (hero is the start entry point). */
    const heroIsFirstTime = previewLearningState === 'new' || isNewResident;

    const heroCtaLabel = heroIsFirstTime ? 'Start my record' : 'Add an achievement';

    const continueLearningItems = useMemo(
        () => mapOpenContentToContinueItems(topUserContent),
        [topUserContent]
    );

    const pickUpIsEmpty = topUserContent.length === 0;

    // --- Discover section (Scenario A / Knowledge Center block) ---
    /** Scenario A — Knowledge Center enabled; gates the entire Discover section. */
    const scenarioA = knowledgeCenterEnabled;

    const { discoverItems, flaggedContent } = useMemo(
        () =>
            buildDiscoverSectionData(
                topUserContent,
                topFacilityContent,
                // Admin-flagged feed not yet on homepage API — wire when available.
                []
            ),
        [topUserContent, topFacilityContent]
    );

    const reflectNudgeByAbsence =
        typeof daysSinceLastVisit === 'number' &&
        daysSinceLastVisit >= REFLECT_NUDGE_DAYS_THRESHOLD;

    const reflectNudgeVisible =
        !reflectNudgeDismissed &&
        learningState !== 'new' &&
        !isNewResident &&
        (showReflectNudge || reflectNudgeByAbsence);

    if (!user) return null;

    return (
        <div className="bg-muted min-h-screen p-6" id="resident-home">
            <div className="mx-auto flex max-w-7xl gap-6">
                <div className="flex-1 space-y-6">
                    {/* ── Header: date + time-aware greeting + upcoming class chip ─── */}
                    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                            <p className="mb-1 text-sm text-muted-foreground">
                                {formatTodayDate()}
                            </p>
                            <h1 className="text-3xl font-bold tracking-tight text-[#203622] dark:text-foreground sm:text-4xl">
                                {timeAwareGreeting()}, {user.name_first ?? 'Student'}.
                            </h1>
                        </div>
                        {hasProgramsHub ? (
                            <UpcomingClassSessionCard
                                events={calendarEventsForDisplay}
                                timezone={user.timezone ?? 'UTC'}
                                isLoading={calendarLoading}
                            />
                        ) : null}
                    </header>

                    {/* ── Reflect / nudge (dismissible; days-since-last-visit driven) ─ */}
                    {reflectNudgeVisible ? (
                        <Alert className="border-[#556830]/30 bg-[#556830]/5">
                            <PenLine className="text-[#556830] dark:text-primary" aria-hidden />
                            <AlertTitle className="text-foreground">
                                Catch up your learning record
                            </AlertTitle>
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    It has been a while since you logged an achievement. Add anything
                                    you have completed recently so your record stays current.
                                </span>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className={learningRecordOutlineButtonClassName}
                                    >
                                        <Link to={`${DIGITAL_TRANSCRIPT_ENTRY_PATH}?intent=new`}>
                                            Log achievements
                                        </Link>
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

                    {/* Tier-1 incomplete-entry banner — sole resume path when an entry is in progress */}
                    <IncompleteEntryReminder
                        hasInProgressEntry={hasInProgressEntry}
                        entry={inProgressEntryReminder}
                        dismissed={incompleteEntryReminderDismissed}
                        onDismiss={dismissIncompleteEntryReminder}
                    />

                    {/* ── Tier 1: Learning Records — primary action, front and center ─ */}
                    <section
                        aria-labelledby="home-learning-records-heading"
                        className="space-y-3"
                    >
                        <div>
                            <h2
                                id="home-learning-records-heading"
                                className="text-xl font-semibold text-foreground"
                            >
                                Learning Record
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Keep track of what you&apos;ve learned.
                            </p>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                        {/* Hero: olive-green primary card (white CTA = the single primary) */}
                        <Card className="border-0 bg-[#556830] p-4 text-white shadow-sm dark:bg-[#556830] lg:col-span-2">
                            <CardContent className="space-y-4 p-4">
                                <div className="space-y-3">
                                    <h3 className="text-2xl font-bold leading-tight">
                                        {heroIsFirstTime
                                            ? 'Start your learning record'
                                            : 'Log a new achievement'}
                                    </h3>
                                    <p className="max-w-xl text-sm leading-relaxed text-white/80">
                                        Write down a class, program, or skill you finished. Your
                                        answers are saved here as you go. Nothing leaves this app
                                        unless you choose to print or share it.
                                    </p>
                                    <PrintShareHelpLink variant="onDark" />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                                    <Button
                                        asChild
                                        size={LEARNING_RECORD_BUTTON_SIZE}
                                        className="gap-1.5 bg-white px-4 text-[#556830] hover:bg-white/90"
                                    >
                                        <Link to={`${DIGITAL_TRANSCRIPT_ENTRY_PATH}?intent=new`}>
                                            {!heroIsFirstTime ? (
                                                <Plus className="size-4" aria-hidden />
                                            ) : null}
                                            {heroCtaLabel}
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <RecentAchievementsPanel
                            totalCount={savedEntries.length}
                            hasInProgressEntry={hasInProgressEntry}
                            onExportClick={() => setExportSheetOpen(true)}
                        />
                        </div>
                    </section>

                    {/* ── Tier 2 (Scenario A only): Knowledge Center ─ */}
                    {knowledgeCenterEnabled ? (
                        <div className="space-y-6">
                            <ContinueLearningSection items={continueLearningItems} />
                            <DiscoverContentSection
                                scenarioA={scenarioA}
                                isNewResident={isNewResident}
                                discoverItems={discoverItems}
                                flaggedContent={flaggedContent}
                                helpfulLinks={helpfulLinks}
                            />
                        </div>
                    ) : null}
                </div>

                {knowledgeCenterEnabled && !pickUpIsEmpty ? (
                    <aside className="hidden w-[320px] shrink-0 space-y-6 self-start sticky top-6 xl:block">
                        <FavoritesPanel favoriteItems={favoriteItems} />
                    </aside>
                ) : null}
            </div>

            <ViewAllAchievementsSheet
                open={exportSheetOpen}
                onOpenChange={setExportSheetOpen}
                entries={achievementsNewestFirst}
                residentName={residentName}
                documentVariant={
                    learningRecordFormVariant === 'funnel' ? 'funnel' : 'default'
                }
            />
        </div>
    );
}

export default ResidentHomeDashboard;
