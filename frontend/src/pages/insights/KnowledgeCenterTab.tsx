import useSWR from 'swr';
import {
    BookOpenIcon,
    UsersIcon,
    ClockIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { KnowledgeCenterMetrics, ServerResponseOne } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTooltip } from '@/components/shared';
import { MetricCard } from './MetricCard';
import { KCContentTable } from './KCContentTable';
import { InsightsDateParams } from './insightsRange';

interface KnowledgeCenterTabProps {
    dateParams: InsightsDateParams;
    selectedFacility: string;
    rangeLabel: string;
}

function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function formatSessionLength(minutes: number): string {
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
}

export default function KnowledgeCenterTab({
    dateParams,
    selectedFacility,
    rangeLabel
}: KnowledgeCenterTabProps) {
    const query = `facility=${selectedFacility}&start_date=${dateParams.start_date}&end_date=${dateParams.end_date}`;
    const { data, isLoading } = useSWR<
        ServerResponseOne<KnowledgeCenterMetrics>
    >(`/api/department-metrics/knowledge-center?${query}`);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
            </div>
        );
    }

    const metrics = data?.data;
    if (!metrics) {
        return (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
                No Knowledge Center data available for this selection.
            </div>
        );
    }

    const { once, two_to_four, five_plus } = metrics.repeat_engagement;
    const repeatTotal = once + two_to_four + five_plus;
    const maxCategoryViews = Math.max(
        1,
        ...metrics.library_views_by_category.map((c) => c.views)
    );

    const segments = [
        { label: 'Once', count: once, className: 'bg-brand-dark' },
        { label: '2-4 visits', count: two_to_four, className: 'bg-brand' },
        { label: '5+ visits', count: five_plus, className: 'bg-brand/60' }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-brand-dark dark:text-white mb-1 text-lg font-medium">
                    At a glance
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    {rangeLabel}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                        icon={BookOpenIcon}
                        value={metrics.total_interactions.toLocaleString()}
                        label="Total KC Interactions"
                        sub="opens, plays & link clicks"
                        tooltip="Total opens, video plays, and link clicks in the Knowledge Center in the selected range."
                    />
                    <MetricCard
                        icon={UsersIcon}
                        value={metrics.unique_residents.toLocaleString()}
                        label="Unique Residents"
                        sub="distinct residents"
                        tooltip="Distinct residents who accessed any Knowledge Center content in the selected range."
                    />
                    <MetricCard
                        icon={ClockIcon}
                        value={formatSessionLength(metrics.avg_session_minutes)}
                        label="Avg Session Length"
                        sub="per interaction"
                        tooltip="Average duration of a Knowledge Center interaction (open to close) in the selected range."
                    />
                    <MetricCard
                        icon={ArrowPathIcon}
                        value={`${pct(five_plus, repeatTotal)}%`}
                        label="Repeat Engagement"
                        sub="5+ visits in range"
                        tooltip="Share of Knowledge Center users who returned 5 or more times in the selected range."
                    />
                </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-brand-dark dark:text-white font-medium">
                        Repeat Engagement
                    </h3>
                    <span className="text-sm text-muted-foreground">
                        Unique users by visit count
                    </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    How many times did residents return to the Knowledge Center?
                </p>
                {repeatTotal === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No Knowledge Center visits in this range.
                    </p>
                ) : (
                    <>
                        <div className="flex rounded-lg overflow-hidden h-9 mb-3">
                            {segments.map(
                                (segment) =>
                                    segment.count > 0 && (
                                        <div
                                            key={segment.label}
                                            className={`flex items-center justify-center text-white text-xs ${segment.className}`}
                                            style={{
                                                width: `${pct(segment.count, repeatTotal)}%`
                                            }}
                                        >
                                            {segment.label} ·{' '}
                                            {pct(segment.count, repeatTotal)}%
                                        </div>
                                    )
                            )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                            {segments.map((segment) => (
                                <span key={segment.label}>
                                    {segment.label} (
                                    {segment.count.toLocaleString()} users)
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-brand-dark dark:text-white font-medium">
                        Library Views by Category
                    </h3>
                    <span className="text-sm text-muted-foreground">
                        Total views · libraries only
                    </span>
                </div>
                <div className="flex items-start gap-2 mb-5">
                    <InfoTooltip>
                        Total library views across categories for the selected
                        range. Video content is a separate resource type and is
                        not counted here.
                    </InfoTooltip>
                    <p className="text-xs text-muted-foreground">
                        Library views grouped by category tag.
                    </p>
                </div>
                {metrics.library_views_by_category.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No categorized library views in this range.
                    </p>
                ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                        {metrics.library_views_by_category.map(
                            (category, i) => (
                                <div
                                    key={category.category}
                                    className={`flex items-center gap-4 px-4 py-3 ${i < metrics.library_views_by_category.length - 1 ? 'border-b border-border' : ''}`}
                                >
                                    <span className="text-sm text-muted-foreground w-44 shrink-0">
                                        {category.category}
                                    </span>
                                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-brand"
                                            style={{
                                                width: `${(category.views / maxCategoryViews) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm text-muted-foreground w-14 text-right shrink-0">
                                        {category.views.toLocaleString()}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KCContentTable
                    title="Top Libraries Accessed"
                    nameLabel="Library"
                    valueLabel="Opens"
                    rows={metrics.top_libraries}
                />
                <KCContentTable
                    title="Top Videos Accessed"
                    nameLabel="Video"
                    valueLabel="Views"
                    rows={metrics.top_videos}
                />
            </div>
        </div>
    );
}
