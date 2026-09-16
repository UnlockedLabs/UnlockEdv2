import useSWR from 'swr';
import { UsersIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
    ProgramCompletionMatrixCell,
    ProgramEngagementOverview,
    ProgramLoadDistribution,
    ProgramTypeEnrollment,
    SecondProgramEnrollmentRow,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from '@/components/ui/chart';
import { MetricCard } from './MetricCard';
import { InsightsDateParams, dateQuery } from './insightsRange';

const LOAD_CHART_CONFIG: ChartConfig = {
    count: { label: 'Residents', color: 'var(--chart-1)' }
};

const TYPE_CHART_CONFIG: ChartConfig = {
    enrolled: { label: 'Enrolled', color: 'var(--chart-1)' }
};

interface ProgramsTabProps {
    dateParams: InsightsDateParams;
    selectedFacility: string;
    rangeLabel: string;
}

function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function matrixCellClass(cell: ProgramCompletionMatrixCell): string {
    if (cell.insufficient) return 'bg-muted text-muted-foreground';
    if (cell.delta_from_facility_average > 15)
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (cell.delta_from_facility_average > 5)
        return 'bg-green-50 dark:bg-green-900/15 text-green-700 dark:text-green-400';
    if (cell.delta_from_facility_average < -15)
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (cell.delta_from_facility_average < -5)
        return 'bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-400';
    return 'bg-transparent text-foreground';
}

export default function ProgramsTab({
    dateParams,
    selectedFacility,
    rangeLabel
}: ProgramsTabProps) {
    const query = `facility=${selectedFacility}&${dateQuery(dateParams)}`;

    const { data: engagementResp, isLoading: engagementLoading } = useSWR<
        ServerResponseOne<ProgramEngagementOverview>
    >(`/api/department-metrics/programs/engagement-overview?${query}`);

    const { data: secondEnrollmentResp } = useSWR<
        ServerResponseMany<SecondProgramEnrollmentRow>
    >(
        `/api/department-metrics/programs/second-enrollment?facility=${selectedFacility}`
    );

    const { data: matrixResp } = useSWR<
        ServerResponseMany<ProgramCompletionMatrixCell>
    >(
        `/api/department-metrics/programs/completion-matrix?facility=${selectedFacility}`
    );

    const { data: loadResp } = useSWR<
        ServerResponseOne<ProgramLoadDistribution>
    >(
        `/api/department-metrics/programs/load-distribution?facility=${selectedFacility}`
    );

    const { data: enrollmentByTypeResp } = useSWR<
        ServerResponseMany<ProgramTypeEnrollment>
    >('/api/department-metrics/programs/enrollment-by-type');

    if (engagementLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-lg" />
            </div>
        );
    }

    const engagement = engagementResp?.data;
    if (!engagement) {
        return (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
                No program data available for this selection.
            </div>
        );
    }

    const neverEngagedPct = pct(
        engagement.never_engaged_residents,
        engagement.total_residents
    );
    const activePct = pct(
        engagement.active_residents,
        engagement.total_residents
    );
    const topProgram = engagement.top_programs[0];
    const maxCompletionRate = Math.max(
        1,
        ...engagement.top_programs.map((p) => p.completion_rate)
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-brand-dark dark:text-white mb-1 text-lg font-medium">
                    Engagement Overview
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    {rangeLabel}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard
                        icon={UsersIcon}
                        value={engagement.active_residents.toLocaleString()}
                        label="Active Residents"
                        sub={`${activePct}% of residents`}
                        tooltip="Residents currently enrolled and active in at least one program."
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
                    Active vs. Never Engaged
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Share of residents currently active in a program
                </p>
                <div className="flex rounded-lg overflow-hidden h-9 mb-3">
                    {engagement.active_residents > 0 && (
                        <div
                            className="flex items-center justify-center text-white text-xs bg-brand"
                            style={{ width: `${activePct}%` }}
                        >
                            Active · {activePct}%
                        </div>
                    )}
                    {engagement.never_engaged_residents > 0 && (
                        <div
                            className="flex items-center justify-center text-white text-xs bg-muted-foreground"
                            style={{ width: `${neverEngagedPct}%` }}
                        >
                            Never engaged · {neverEngagedPct}%
                        </div>
                    )}
                </div>
            </div>

            {engagement.top_programs.length > 0 && (
                <div className="bg-card rounded-lg border border-border p-6">
                    <h3 className="text-brand-dark dark:text-white font-medium mb-1">
                        Top Programs by Completion Rate
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Programs with at least 5 enrollees
                    </p>
                    <div className="border border-border rounded-lg overflow-hidden">
                        {engagement.top_programs.map((program, i) => (
                            <div
                                key={program.program_name}
                                className={`flex items-center gap-4 px-4 py-3 ${i < engagement.top_programs.length - 1 ? 'border-b border-border' : ''}`}
                            >
                                <span className="text-sm text-muted-foreground w-44 shrink-0 truncate">
                                    {program.program_name}
                                </span>
                                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-brand"
                                        style={{
                                            width: `${(program.completion_rate / maxCompletionRate) * 100}%`
                                        }}
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground w-14 text-right shrink-0">
                                    {Math.round(program.completion_rate)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {secondEnrollmentResp?.data &&
                secondEnrollmentResp.data.length > 0 && (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="px-6 pt-5 pb-4">
                            <h3 className="text-brand-dark dark:text-white font-medium">
                                Second Program Enrollment After First Completion
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                By facility and the completed program's type
                            </p>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Facility</TableHead>
                                    <TableHead>First Program Type</TableHead>
                                    <TableHead className="text-right">
                                        Completed First
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Enrolled in Second
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Rate
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {secondEnrollmentResp.data.map((row) => (
                                    <TableRow
                                        key={`${row.facility_name}-${row.program_type}`}
                                    >
                                        <TableCell className="text-muted-foreground">
                                            {row.facility_name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {row.program_type}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.completed_first.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.enrolled_second.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-brand"
                                                        style={{
                                                            width: `${row.rate}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-muted-foreground w-10 text-right">
                                                    {Math.round(row.rate)}%
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

            {matrixResp?.data && matrixResp.data.length > 0 && (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="px-6 pt-5 pb-4">
                        <h3 className="text-brand-dark dark:text-white font-medium">
                            Facility × Program Completion Matrix
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Completion rate per program, colored by delta from
                            that facility's own average. Cells with fewer than 3
                            enrollees are marked insufficient data.
                        </p>
                    </div>
                    <ProgramMatrixTable cells={matrixResp.data} />
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-6 pb-5 text-xs text-muted-foreground">
                        <LegendSwatch
                            className="bg-green-100 dark:bg-green-900/30"
                            label="+15pp+"
                        />
                        <LegendSwatch
                            className="bg-green-50 dark:bg-green-900/15"
                            label="+5-15pp"
                        />
                        <LegendSwatch
                            className="bg-red-50 dark:bg-red-900/15"
                            label="-5-15pp"
                        />
                        <LegendSwatch
                            className="bg-red-100 dark:bg-red-900/30"
                            label="-15pp+"
                        />
                        <LegendSwatch className="bg-muted" label="n<3" />
                    </div>
                </div>
            )}

            {loadResp?.data && (
                <div>
                    <h2 className="text-brand-dark dark:text-white mb-1 text-lg font-medium">
                        Program Load Distribution
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Concurrent active enrollments per resident
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card rounded-lg border border-border p-6">
                            <h3 className="text-brand-dark dark:text-white font-medium mb-4">
                                Statewide
                            </h3>
                            <ChartContainer
                                config={LOAD_CHART_CONFIG}
                                className="h-56 w-full"
                            >
                                <BarChart data={loadResp.data.statewide}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="bucket"
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false}
                                    />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={4}
                                    />
                                </BarChart>
                            </ChartContainer>
                        </div>
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                            <div className="px-6 pt-5 pb-4">
                                <h3 className="text-brand-dark dark:text-white font-medium">
                                    By Facility
                                </h3>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Facility</TableHead>
                                        <TableHead className="text-right">
                                            0
                                        </TableHead>
                                        <TableHead className="text-right">
                                            1
                                        </TableHead>
                                        <TableHead className="text-right">
                                            2
                                        </TableHead>
                                        <TableHead className="text-right">
                                            3
                                        </TableHead>
                                        <TableHead className="text-right">
                                            4+
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadResp.data.by_facility.map((row) => {
                                        const zeroShare =
                                            row.total > 0
                                                ? row.zero / row.total
                                                : 0;
                                        return (
                                            <TableRow key={row.facility_id}>
                                                <TableCell className="font-medium text-brand-dark dark:text-white">
                                                    {row.facility_name}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {zeroShare > 0.4 ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="badge-amber"
                                                        >
                                                            {row.zero}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            {row.zero}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {row.one}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {row.two}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {row.three}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {row.four_plus}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {enrollmentByTypeResp?.data &&
                enrollmentByTypeResp.data.length > 0 && (
                    <div className="bg-card rounded-lg border border-border p-6">
                        <h3 className="text-brand-dark dark:text-white font-medium mb-1">
                            Enrollment by Program Type (Statewide)
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Top program types by enrollment; remaining types
                            grouped as Other
                        </p>
                        <ChartContainer
                            config={TYPE_CHART_CONFIG}
                            className="h-56 w-full"
                        >
                            <BarChart data={enrollmentByTypeResp.data}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="program_type"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                />
                                <Bar
                                    dataKey="enrolled"
                                    fill="var(--color-enrolled)"
                                    radius={4}
                                />
                            </BarChart>
                        </ChartContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">
                                        Enrolled
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Completed
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Rate
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrollmentByTypeResp.data.map((row) => (
                                    <TableRow key={row.program_type}>
                                        <TableCell className="text-muted-foreground">
                                            {row.program_type}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.enrolled.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.completed.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-brand"
                                                        style={{
                                                            width: `${row.rate}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-muted-foreground w-10 text-right">
                                                    {Math.round(row.rate)}%
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

            {topProgram && (
                <Alert
                    role="note"
                    className="border-amber-200 bg-amber-50 dark:bg-amber-900/20"
                >
                    <AlertTitle className="text-foreground">
                        Action item
                    </AlertTitle>
                    <AlertDescription>
                        <span className="text-sm leading-relaxed">
                            {neverEngagedPct}% of residents have never engaged
                            with a program. {topProgram.program_name} leads at{' '}
                            {Math.round(topProgram.completion_rate)}% completion
                            — consider outreach to never-engaged residents
                            before adding new program capacity.
                        </span>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

function LegendSwatch({
    className,
    label
}: {
    className: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm shrink-0 ${className}`} />
            {label}
        </div>
    );
}

function ProgramMatrixTable({
    cells
}: {
    cells: ProgramCompletionMatrixCell[];
}) {
    const programs = Array.from(new Set(cells.map((c) => c.program_name))).sort(
        (a, b) => a.localeCompare(b)
    );
    const facilities = Array.from(
        new Map(cells.map((c) => [c.facility_id, c.facility_name])).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));
    const cellByKey = new Map(
        cells.map((c) => [`${c.program_name}::${c.facility_id}`, c])
    );

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Program</TableHead>
                    {facilities.map(([id, name]) => (
                        <TableHead key={id} className="text-center">
                            {name}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {programs.map((program) => (
                    <TableRow key={program}>
                        <TableCell className="font-medium text-brand-dark dark:text-white">
                            {program}
                        </TableCell>
                        {facilities.map(([id]) => {
                            const cell = cellByKey.get(`${program}::${id}`);
                            if (!cell) {
                                return (
                                    <TableCell
                                        key={id}
                                        className="text-center text-muted-foreground"
                                    >
                                        —
                                    </TableCell>
                                );
                            }
                            return (
                                <TableCell
                                    key={id}
                                    className={`text-center ${matrixCellClass(cell)}`}
                                    title={
                                        cell.insufficient
                                            ? `n=${cell.enrolled} (insufficient data, need 3+)`
                                            : `n=${cell.enrolled}, rate=${Math.round(cell.completion_rate)}%, delta=${cell.delta_from_facility_average >= 0 ? '+' : ''}${Math.round(cell.delta_from_facility_average)}pp`
                                    }
                                >
                                    {cell.insufficient
                                        ? '—'
                                        : `${Math.round(cell.completion_rate)}%`}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
