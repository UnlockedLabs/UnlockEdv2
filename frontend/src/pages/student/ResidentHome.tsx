import { useEffect, useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import {
    OpenContentItem,
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import {
    ResidentHomeDashboard,
    type ResidentHomeLearningState,
    type ResidentHomeScenario
} from '@/pages/student/ResidentHomeDashboard';

const LAST_HOME_VISIT_KEY = 'unlocked.resident-home.last-visit';

interface ResidentHomeData {
    helpfulLinks: HelpfulLink[];
    topUserContent: OpenContentItem[];
    topFacilityContent: OpenContentItem[];
    featuredLibraries: OpenContentItem[];
    favorites: OpenContentItem[];
}

function parsePreviewScenario(raw: string | null): ResidentHomeScenario | undefined {
    if (raw === 'a' || raw === 'both') return 'knowledgeCenterAndLearningRecords';
    if (raw === 'b' || raw === 'records') return 'learningRecordsOnly';
    return undefined;
}

function parsePreviewLearningState(
    raw: string | null
): ResidentHomeLearningState | undefined {
    if (raw === 'new') return 'new';
    if (raw === 'incomplete' || raw === 'resume') return 'returningWithIncomplete';
    if (raw === 'complete' || raw === 'returning') return 'returningComplete';
    return undefined;
}

export default function ResidentHome() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const { topUserContent, topFacilityContent, featuredLibraries } =
        useLoaderData() as ResidentHomeData;

    const { entries, hasDraft, hydrated } = useTranscriptDraft();

    const { data: favorites } = useSWR<ServerResponseMany<OpenContentItem>>(
        '/api/open-content/favorite-groupings'
    );
    const { data: helpfulLinks } =
        useSWR<ServerResponseOne<HelpfulLinkAndSort>>('/api/helpful-links');

    const scenario = parsePreviewScenario(searchParams.get('homeScenario'));
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
        try {
            localStorage.setItem(LAST_HOME_VISIT_KEY, new Date().toISOString());
        } catch {
            /* ignore — last-visit used for reflect nudge on the next home load */
        }
    }, []);

    if (!user || !hydrated) return null;

    const favoriteItems = favorites?.data ?? [];
    const links = helpfulLinks?.data?.helpful_links ?? [];

    return (
        <ResidentHomeDashboard
            scenario={scenario}
            previewLearningState={previewLearningState}
            showReflectNudge={showReflectNudge}
            daysSinceLastVisit={daysSinceLastVisit}
            learningRecordEntries={entries}
            hasIncompleteEntry={hasDraft}
            topUserContent={topUserContent}
            topFacilityContent={topFacilityContent}
            featuredLibraries={featuredLibraries ?? []}
            favoriteItems={favoriteItems}
            helpfulLinks={links}
        />
    );
}
