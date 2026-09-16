import useSWR from 'swr';
import { UsersIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
    ProgramEngagementOverview,
    SecondProgramEnrollmentRow,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { MetricCard } from './MetricCard';
import { InsightsDateParams, dateQuery } from './insightsRange';

interface ProgramsTabProps {
    dateParams: InsightsDateParams;
    selectedFacility: string;
    rangeLabel: string;
}

function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
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
