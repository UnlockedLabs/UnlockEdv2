import { UsersIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { ProgramEngagementOverview } from '@/types';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from '@/components/ui/chart';
import { MetricCard } from './MetricCard';
import { LegendSwatch } from './ProgramMatrixTable';
import { pct } from './programsUtils';

const ENGAGEMENT_DONUT_CONFIG: ChartConfig = {
    active: { label: 'Active', color: 'var(--brand)' },
    previously_engaged: {
        label: 'Previously engaged',
        color: 'var(--brand-gold)'
    },
    never_engaged: { label: 'Never engaged', color: 'var(--muted-foreground)' }
};

const TOP_PROGRAMS_CHART_CONFIG: ChartConfig = {
    completion_rate: { label: 'Completion rate', color: 'var(--brand)' }
};

// Traffic-light bands adapted from the source tool's green/blue/orange scheme,
// swapping blue (not in the UnlockEd palette) for brand gold.
function topProgramBarColor(rate: number): string {
    if (rate >= 50) return 'var(--brand)';
    if (rate >= 35) return 'var(--brand-gold)';
    return '#ef4444';
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface EngagementOverviewSectionProps {
    engagement: ProgramEngagementOverview;
    rangeLabel: string;
}

export function EngagementOverviewSection({
    engagement,
    rangeLabel
}: EngagementOverviewSectionProps) {
    const neverEngagedPct = pct(
        engagement.never_engaged_residents,
        engagement.total_residents
    );
    const activePct = pct(
        engagement.active_residents,
        engagement.total_residents
    );
    const previouslyEngagedPct = pct(
        engagement.previously_engaged_residents,
        engagement.total_residents
    );
    const topProgram = engagement.top_programs[0];

    return (
        <>
            <div>
                <h2 className="text-brand-dark dark:text-white mb-1 text-lg font-medium">
                    Engagement Overview
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    {rangeLabel}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                        icon={UsersIcon}
                        value={engagement.active_residents.toLocaleString()}
                        label="Active Residents"
                        sub={`${activePct}% of residents`}
                        tooltip="Residents engaged in at least one program at any point during the selected range."
                    />
                    <MetricCard
                        icon={UserGroupIcon}
                        value={engagement.previously_engaged_residents.toLocaleString()}
                        label="Previously Engaged"
                        sub={`${previouslyEngagedPct}% of residents`}
                        tooltip="Residents who have had a program enrollment, but not during the selected range."
                    />
                    <MetricCard
                        icon={UserGroupIcon}
                        value={engagement.never_engaged_residents.toLocaleString()}
                        label="Never Engaged"
                        sub={`${neverEngagedPct}% of residents`}
                        tooltip="Residents who have never had a program enrollment."
                    />
                    <MetricCard
                        icon={UsersIcon}
                        value={engagement.total_residents.toLocaleString()}
                        label="Total Residents"
                        sub="in current selection"
                        tooltip="All residents in the selected facility scope."
                    />
                </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-brand-dark dark:text-white font-medium mb-1">
                    Active vs. Previously Engaged vs. Never Engaged
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {activePct}% of residents are active in a program during
                    this range; {previouslyEngagedPct}% engaged before but not
                    in this range; {neverEngagedPct}% have never engaged with
                    any program.
                    {topProgram &&
                        ` ${topProgram.program_name} leads at ${Math.round(topProgram.completion_rate)}% completion.`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-wrap items-center gap-6 min-w-0">
                        {engagement.total_residents === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No resident data available for this selection.
                            </p>
                        ) : (
                            <>
                                <ChartContainer
                                    config={ENGAGEMENT_DONUT_CONFIG}
                                    className="h-44 w-44 shrink-0 aspect-square"
                                >
                                    <PieChart>
                                        <ChartTooltip
                                            content={<ChartTooltipContent />}
                                        />
                                        <Pie
                                            data={[
                                                {
                                                    key: 'active',
                                                    name: 'Active',
                                                    value: engagement.active_residents
                                                },
                                                {
                                                    key: 'previously_engaged',
                                                    name: 'Previously engaged',
                                                    value: engagement.previously_engaged_residents
                                                },
                                                {
                                                    key: 'never_engaged',
                                                    name: 'Never engaged',
                                                    value: engagement.never_engaged_residents
                                                }
                                            ]}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={50}
                                            outerRadius={80}
                                            isAnimationActive={false}
                                        >
                                            <Cell fill="var(--color-active)" />
                                            <Cell fill="var(--color-previously_engaged)" />
                                            <Cell fill="var(--color-never_engaged)" />
                                        </Pie>
                                    </PieChart>
                                </ChartContainer>
                                <div className="space-y-2 min-w-0">
                                    <LegendSwatch
                                        className="bg-brand"
                                        label={`Active (${activePct}%)`}
                                    />
                                    <LegendSwatch
                                        className="bg-brand-gold"
                                        label={`Previously engaged (${previouslyEngagedPct}%)`}
                                    />
                                    <LegendSwatch
                                        className="bg-muted-foreground"
                                        label={`Never engaged (${neverEngagedPct}%)`}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="min-w-0">
                        {engagement.top_programs.length > 0 ? (
                            <>
                                <p className="text-sm text-muted-foreground mb-2">
                                    {topProgram.program_name} leads at{' '}
                                    {Math.round(topProgram.completion_rate)}
                                    %. Median:{' '}
                                    {Math.round(
                                        median(
                                            engagement.top_programs.map(
                                                (p) => p.completion_rate
                                            )
                                        )
                                    )}
                                    %.
                                </p>
                                <ChartContainer
                                    config={TOP_PROGRAMS_CHART_CONFIG}
                                    className="h-44 w-full"
                                >
                                    <BarChart
                                        data={engagement.top_programs}
                                        layout="vertical"
                                        margin={{ left: 8 }}
                                    >
                                        <CartesianGrid horizontal={false} />
                                        <XAxis
                                            type="number"
                                            domain={[0, 100]}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="program_name"
                                            tickLine={false}
                                            axisLine={false}
                                            width={110}
                                        />
                                        <ChartTooltip
                                            content={<ChartTooltipContent />}
                                        />
                                        <Bar
                                            dataKey="completion_rate"
                                            radius={4}
                                            isAnimationActive={false}
                                        >
                                            {engagement.top_programs.map(
                                                (program) => (
                                                    <Cell
                                                        key={
                                                            program.program_name
                                                        }
                                                        fill={topProgramBarColor(
                                                            program.completion_rate
                                                        )}
                                                    />
                                                )
                                            )}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No programs with at least 5 enrollees in this
                                selection.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
