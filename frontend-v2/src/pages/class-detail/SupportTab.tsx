import { useMemo } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EnrollmentAttendance, EnrollmentStatus } from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';

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
    records: EnrollmentAttendance[]
): AtRiskResident[] {
    const byUser = new Map<number, EnrollmentAttendance[]>();

    for (const r of records) {
        if (r.enrollment_status !== EnrollmentStatus.Enrolled) continue;
        const existing = byUser.get(r.user_id) ?? [];
        existing.push(r);
        byUser.set(r.user_id, existing);
    }

    const residents: AtRiskResident[] = [];

    byUser.forEach((userRecords, userId) => {
        const withStatus = userRecords.filter((r) => r.attendance_status);
        const total = withStatus.length;
        if (total === 0) return;

        const attended = withStatus.filter(
            (r) =>
                r.attendance_status === 'present' ||
                r.attendance_status === 'partial'
        ).length;

        const rate = Math.round((attended / total) * 100);
        const missed = total - attended;

        const sorted = [...withStatus].sort((a, b) =>
            (a.date ?? '').localeCompare(b.date ?? '')
        );
        let consecutive = 0;
        for (let i = sorted.length - 1; i >= 0; i--) {
            const s = sorted[i];
            if (
                s?.attendance_status === 'absent_excused' ||
                s?.attendance_status === 'absent_unexcused'
            ) {
                consecutive++;
            } else {
                break;
            }
        }

        if (rate < 75 || consecutive >= 2) {
            const first = userRecords[0];
            residents.push({
                userId,
                docId: first?.doc_id ?? '',
                name: `${first?.name_first ?? ''} ${first?.name_last ?? ''}`.trim(),
                attendanceRate: rate,
                totalSessions: total,
                attendedSessions: attended,
                missedSessions: missed,
                consecutiveMissed: consecutive
            });
        }
    });

    return residents.sort((a, b) => a.attendanceRate - b.attendanceRate);
}

export function SupportTab({ classId }: SupportTabProps) {
    const { data: attendanceResp } = useSWR<
        ServerResponseMany<EnrollmentAttendance>
    >(`/api/program-classes/${classId}/enrollments`);

    const atRisk = useMemo(() => {
        if (!attendanceResp?.data) return [];
        return computeAtRiskResidents(attendanceResp.data);
    }, [attendanceResp]);

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-[#203622] font-semibold">
                    At-Risk Residents ({atRisk.length})
                </h3>
                <p className="text-sm text-gray-600 mt-1">
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
                            className="px-6 py-4 bg-amber-50/20"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-6 flex-1">
                                    <div className="min-w-[80px]">
                                        <div className="text-[#203622] font-medium">
                                            {resident.docId}
                                        </div>
                                        <div className="text-sm text-gray-600 mt-0.5">
                                            {resident.name}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm text-gray-600">
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
                                            className="h-2 w-64 mb-2"
                                            indicatorClassName="bg-[#F1B51C]"
                                        />
                                        <div className="flex gap-4 text-xs text-gray-600">
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
