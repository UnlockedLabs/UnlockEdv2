import { useMemo } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Attendance, ClassEnrollment } from '@/types/attendance';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { computeAttendanceByUser } from '@/lib/attendance-utils';

interface SupportTabProps {
    classId: number;
}

interface AtRiskResident {
    userId: number;
    docId: string;
    name: string;
    attendanceRate: number;
    totalSessions: number;
    attendedSessions: number;
    missedSessions: number;
    consecutiveMissed: number;
}

function computeAtRiskResidents(
    instances: ClassEventInstance[],
    enrollments: ClassEnrollment[]
): AtRiskResident[] {
    const attendanceMap = computeAttendanceByUser(instances);
    const enrolledUsers = new Map(
        enrollments.map((e) => [e.user_id, e])
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const residents: AtRiskResident[] = [];

    attendanceMap.forEach((stats, userId) => {
        if (stats.total === 0) return;
        const enrollment = enrolledUsers.get(userId);
        if (!enrollment) return;

        const userRecords: { date: string; status: Attendance }[] = [];
        for (const inst of instances) {
            if (inst.is_cancelled) continue;
            const [y, m, d] = inst.date.split('-').map(Number);
            if (new Date(y, m - 1, d) > today) continue;
            for (const rec of inst.attendance_records ?? []) {
                if (rec.user_id === userId) {
                    userRecords.push({
                        date: inst.date,
                        status: rec.attendance_status
                    });
                }
            }
        }
        userRecords.sort((a, b) => a.date.localeCompare(b.date));

        let consecutive = 0;
        for (let i = userRecords.length - 1; i >= 0; i--) {
            const s = userRecords[i];
            if (
                s?.status === Attendance.Absent_Excused ||
                s?.status === Attendance.Absent_Unexcused
            ) {
                consecutive++;
            } else {
                break;
            }
        }

        if (stats.rate < 75 || consecutive >= 2) {
            residents.push({
                userId,
                docId: enrollment.doc_id ?? '',
                name: enrollment.name_full ?? '',
                attendanceRate: stats.rate,
                totalSessions: stats.total,
                attendedSessions: stats.attended,
                missedSessions: stats.total - stats.attended,
                consecutiveMissed: consecutive
            });
        }
    });

    return residents.sort((a, b) => a.attendanceRate - b.attendanceRate);
}

export function SupportTab({ classId }: SupportTabProps) {
    const { data: eventsResp } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${classId}/events?all=true`);

    const { data: enrollmentResp } = useSWR<
        ServerResponseMany<ClassEnrollment>
    >(`/api/program-classes/${classId}/enrollments`);

    const atRisk = useMemo(() => {
        if (!eventsResp?.data || !enrollmentResp?.data) return [];
        return computeAtRiskResidents(eventsResp.data, enrollmentResp.data);
    }, [eventsResp, enrollmentResp]);

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
                <h3 className="text-[#203622] font-semibold">
                    At-Risk Residents ({atRisk.length})
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    Residents with attendance below 75% or multiple consecutive
                    absences
                </p>
            </div>
            {atRisk.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="size-12 mx-auto mb-3 text-[#556830]" />
                    <p className="font-medium text-[#203622]">
                        All residents are engaged!
                    </p>
                    <p className="text-sm mt-1">
                        No residents currently need additional support
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200">
                    {atRisk.map((resident) => (
                        <div
                            key={resident.userId}
                            className="px-4 sm:px-6 py-4 bg-amber-50/20"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex items-start gap-3 sm:gap-6 flex-1">
                                    <div className="w-[100px] sm:w-[140px] shrink-0">
                                        <div className="text-[#203622] font-medium truncate">
                                            {resident.docId}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-0.5 truncate">
                                            {resident.name}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm text-gray-500">
                                                Attendance:
                                            </span>
                                            <span className="text-sm text-[#203622] font-medium">
                                                {resident.attendanceRate}%
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                ({resident.attendedSessions}/
                                                {resident.totalSessions}{' '}
                                                sessions)
                                            </span>
                                        </div>
                                        <Progress
                                            value={resident.attendanceRate}
                                            className="h-2 w-full max-w-64 mb-2"
                                            indicatorClassName="bg-[#F1B51C]"
                                        />
                                        <div className="flex gap-4 text-xs text-gray-500">
                                            <span>
                                                Missed:{' '}
                                                {resident.missedSessions}{' '}
                                                sessions
                                            </span>
                                            {resident.consecutiveMissed > 0 && (
                                                <span className="text-amber-700 font-medium">
                                                    {
                                                        resident.consecutiveMissed
                                                    }{' '}
                                                    consecutive absences
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200"
                                >
                                    <AlertCircle className="size-3 mr-1" />
                                    Needs Support
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
