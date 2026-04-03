import { useMemo, useState } from 'react';
import useSWR from 'swr';
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
import { ServerResponseMany } from '@/types/server';
import { getEnrollmentStatusColor, formatEnrollmentStatus } from '@/lib/formatters';

type StatusFilter = 'all' | EnrollmentStatus;
type TimeFilter = 'week' | 'month' | '3months' | 'all';

interface EnrollmentHistoryTabProps {
    classId: number;
}

export function EnrollmentHistoryTab({ classId }: EnrollmentHistoryTabProps) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

    const { data: enrollmentResp } = useSWR<ServerResponseMany<ClassEnrollment>>(
        `/api/program-classes/${classId}/enrollments?status=not_enrolled&per_page=1000`
    );

    const historicalEnrollments = useMemo(() => {
        return (enrollmentResp?.data ?? []).sort((a, b) => {
            const dateA = new Date(
                a.enrollment_ended_at ?? a.completion_dt ?? a.updated_at
            ).getTime();
            const dateB = new Date(
                b.enrollment_ended_at ?? b.completion_dt ?? b.updated_at
            ).getTime();
            return dateB - dateA;
        });
    }, [enrollmentResp]);

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
                const dt =
                    e.enrollment_ended_at ?? e.completion_dt ?? e.updated_at;
                return new Date(dt) >= cutoff;
            });
        }

        return result;
    }, [historicalEnrollments, statusFilter, timeFilter]);

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                        <h3 className="text-[#203622]">
                            Enrollment History ({historicalEnrollments.length})
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            View past enrollments and completion records
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-sm text-gray-500 mb-1 block">
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
                        <label className="text-sm text-gray-500 mb-1 block">
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
                <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="size-12 mx-auto mb-3 text-gray-500" />
                    <p>No historical enrollments found</p>
                    <p className="text-sm mt-1">
                        Adjust filters to see more records
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200">
                    {filtered.map((enrollment) => (
                        <div
                            key={enrollment.id}
                            className="px-4 sm:px-6 py-4 hover:bg-[#E2E7EA]/30 transition-colors"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div className="flex items-start gap-3 sm:gap-6 flex-1">
                                    <div className="w-[160px] shrink-0">
                                        <div className="text-[#203622] font-medium truncate">
                                            {enrollment.doc_id}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-0.5 truncate">
                                            {enrollment.name_full}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge
                                                variant="outline"
                                                className={`font-semibold ${getEnrollmentStatusColor(
                                                    enrollment.enrollment_status
                                                )}`}
                                            >
                                                {formatEnrollmentStatus(enrollment.enrollment_status)}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-gray-500 space-y-1">
                                            <div className="flex">
                                                <span className="font-medium w-24">
                                                    Enrolled:
                                                </span>
                                                <span>
                                                    {enrollment.enrolled_at
                                                        ? new Date(
                                                              enrollment.enrolled_at
                                                          ).toLocaleDateString('en-CA')
                                                        : '-'}
                                                </span>
                                            </div>
                                            {(enrollment.enrollment_ended_at ??
                                                enrollment.completion_dt) && (
                                                <div className="flex">
                                                    <span className="font-medium w-24">
                                                        {enrollment.enrollment_status ===
                                                        EnrollmentStatus.Completed
                                                            ? 'Completed:'
                                                            : 'Ended:'}
                                                    </span>
                                                    <span>
                                                        {new Date(
                                                            enrollment.enrollment_ended_at ??
                                                                enrollment.completion_dt!
                                                        ).toLocaleDateString(
                                                            'en-CA'
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {enrollment.change_reason && (
                                            <div className="mt-3 p-3 bg-[#E2E7EA]/60 rounded-md">
                                                <div className="text-xs text-gray-500 font-medium mb-1">
                                                    Reason:
                                                </div>
                                                <div className="text-sm text-[#203622]">
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
