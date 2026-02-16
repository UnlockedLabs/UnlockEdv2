import { useMemo, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ClassEnrollment, EnrollmentStatus } from '@/types/attendance';
import { getEnrollmentStatusColor } from '@/lib/formatters';

type StatusFilter = 'all' | EnrollmentStatus;
type TimeFilter = 'week' | 'month' | '3months' | 'all';

interface EnrollmentHistoryTabProps {
    enrollments: ClassEnrollment[];
}

export function EnrollmentHistoryTab({ enrollments }: EnrollmentHistoryTabProps) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

    const historicalEnrollments = useMemo(() => {
        return enrollments
            .filter((e) => e.enrollment_status !== EnrollmentStatus.Enrolled)
            .sort((a, b) => {
                const dateA = a.completion_dt
                    ? new Date(a.completion_dt).getTime()
                    : 0;
                const dateB = b.completion_dt
                    ? new Date(b.completion_dt).getTime()
                    : 0;
                return dateB - dateA;
            });
    }, [enrollments]);

    const filtered = useMemo(() => {
        let result = historicalEnrollments;

        if (statusFilter !== 'all') {
            result = result.filter(
                (e) => e.enrollment_status === statusFilter
            );
        }

        if (timeFilter !== 'all') {
            const cutoff = new Date();
            const daysMap: Record<string, number> = {
                week: 7,
                month: 30,
                '3months': 90
            };
            cutoff.setDate(cutoff.getDate() - (daysMap[timeFilter] ?? 0));
            result = result.filter((e) => {
                if (!e.completion_dt) return false;
                return new Date(e.completion_dt) >= cutoff;
            });
        }

        return result;
    }, [historicalEnrollments, statusFilter, timeFilter]);

    return (
        <div className="bg-card rounded-lg border border-border">
            <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-foreground font-semibold">
                            Enrollment History ({historicalEnrollments.length})
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            View past enrollments and completion records
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-sm text-muted-foreground mb-1 block">
                            Status
                        </label>
                        <Select
                            value={statusFilter}
                            onValueChange={(v) =>
                                setStatusFilter(v as StatusFilter)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value={EnrollmentStatus.Completed}>
                                    Completed
                                </SelectItem>
                                <SelectItem value={EnrollmentStatus.Withdrawn}>
                                    Withdrawn
                                </SelectItem>
                                <SelectItem value={EnrollmentStatus.Dropped}>
                                    Dropped
                                </SelectItem>
                                <SelectItem value={EnrollmentStatus.Segregated}>
                                    Segregated
                                </SelectItem>
                                <SelectItem
                                    value={EnrollmentStatus['Failed To Complete']}
                                >
                                    Failed to Complete
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <label className="text-sm text-muted-foreground mb-1 block">
                            Time Period
                        </label>
                        <Select
                            value={timeFilter}
                            onValueChange={(v) =>
                                setTimeFilter(v as TimeFilter)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="week">Last Week</SelectItem>
                                <SelectItem value="month">Last Month</SelectItem>
                                <SelectItem value="3months">
                                    Last 3 Months
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="size-12 mx-auto mb-3 text-muted-foreground" />
                    <p>No historical enrollments found</p>
                    <p className="text-sm mt-1">
                        Adjust filters to see more records
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {filtered.map((enrollment) => (
                        <div
                            key={enrollment.id}
                            className="px-6 py-4 hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-6 flex-1">
                                    <div className="min-w-[100px]">
                                        <div className="text-foreground font-medium">
                                            {enrollment.doc_id}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-0.5">
                                            {enrollment.name_full}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge
                                                variant="outline"
                                                className={getEnrollmentStatusColor(
                                                    enrollment.enrollment_status
                                                )}
                                            >
                                                {enrollment.enrollment_status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            {enrollment.enrolled_at && (
                                                <div className="flex gap-2">
                                                    <span className="font-medium">
                                                        Enrolled:
                                                    </span>
                                                    <span>
                                                        {new Date(
                                                            enrollment.enrolled_at
                                                        ).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                            {enrollment.completion_dt && (
                                                <div className="flex gap-2">
                                                    <span className="font-medium">
                                                        {enrollment.enrollment_status ===
                                                        EnrollmentStatus.Completed
                                                            ? 'Completed:'
                                                            : 'Ended:'}
                                                    </span>
                                                    <span>
                                                        {new Date(
                                                            enrollment.completion_dt
                                                        ).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {enrollment.change_reason && (
                                            <div className="mt-3 p-3 bg-muted rounded-md">
                                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                                    Reason:
                                                </div>
                                                <div className="text-sm text-foreground">
                                                    {enrollment.change_reason}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
