import { useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import {
    ServerResponseMany,
    ResidentProgramOverview,
    EnrollmentStatus
} from '@/types';
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared';
import { formatDate } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

function getEnrollmentStatusStyle(status?: EnrollmentStatus): string {
    switch (status) {
        case EnrollmentStatus.Enrolled:
            return 'bg-green-50 text-green-700 border-green-200';
        case EnrollmentStatus.Completed:
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case EnrollmentStatus.Dropped:
            return 'bg-red-50 text-red-700 border-red-200';
        default:
            return 'bg-gray-50 text-gray-700 border-gray-200';
    }
}

export default function ResidentOverview() {
    const { user } = useAuth();

    if (!user) return null;

    const startDate = useMemo(() => {
        const d = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
        return d.toISOString();
    }, []);
    const endDate = useMemo(() => {
        const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return d.toISOString();
    }, []);

    const { data: programsResp, isLoading } = useSWR<
        ServerResponseMany<ResidentProgramOverview>
    >(`/api/users/${user.id}/programs`);

    const { data: eventsResp } = useSWR<ServerResponseMany<unknown>>(
        `/api/student-calendar?start_dt=${startDate}&end_dt=${endDate}`
    );

    const programs = programsResp?.data ?? [];
    const upcomingEvents = (eventsResp?.data ?? []).length;

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title="My Programs"
                    subtitle={`${programs.length} program${programs.length !== 1 ? 's' : ''} | ${upcomingEvents} upcoming event${upcomingEvents !== 1 ? 's' : ''}`}
                />

                {isLoading && (
                    <p className="text-gray-500 text-center py-8">Loading...</p>
                )}

                {!isLoading && programs.length === 0 && (
                    <EmptyState
                        icon={
                            <GraduationCap className="size-6 text-gray-400" />
                        }
                        title="No programs yet"
                        description="You are not currently enrolled in any programs."
                    />
                )}

                {!isLoading && programs.length > 0 && (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50/50">
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Program
                                            </th>
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Class
                                            </th>
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Status
                                            </th>
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Enrollment
                                            </th>
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Start Date
                                            </th>
                                            <th className="text-left py-3 px-5 text-gray-500 font-medium">
                                                Attendance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {programs.map((prog, idx) => (
                                            <tr
                                                key={idx}
                                                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
                                            >
                                                <td className="py-3 px-5 font-medium text-[#203622]">
                                                    {prog.program_name}
                                                </td>
                                                <td className="py-3 px-5 text-gray-600">
                                                    {prog.class_name}
                                                </td>
                                                <td className="py-3 px-5">
                                                    <StatusBadge
                                                        status={prog.status}
                                                        variant="progClass"
                                                    />
                                                </td>
                                                <td className="py-3 px-5">
                                                    {prog.enrollment_status && (
                                                        <StatusBadge
                                                            status={
                                                                prog.enrollment_status
                                                            }
                                                            className={getEnrollmentStatusStyle(
                                                                prog.enrollment_status
                                                            )}
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-3 px-5 text-gray-500">
                                                    {formatDate(
                                                        prog.start_date
                                                    )}
                                                </td>
                                                <td className="py-3 px-5 text-gray-500">
                                                    {prog.attendance_percentage !==
                                                    undefined
                                                        ? `${Math.round(prog.attendance_percentage)}%`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
