import useSWR from 'swr';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AttendanceFlag } from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';

interface SupportTabProps {
    classId: number;
}

export function SupportTab({ classId }: SupportTabProps) {
    const { data: flagsResp } = useSWR<ServerResponseMany<AttendanceFlag>>(
        `/api/program-classes/${classId}/attendance-flags`
    );

    const flags = flagsResp?.data ?? [];

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-[#203622]">
                    At-Risk Residents ({flagsResp?.meta?.total ?? 0})
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                    Residents with attendance below 75% or multiple consecutive absences
                </p>
            </div>
            {flags.length === 0 ? (
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
                    {flags.map((flag, idx) => (
                        <div
                            key={`${flag.doc_id}-${idx}`}
                            className="px-6 py-4 bg-amber-50/20"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-6 flex-1">
                                    <div className="w-[160px] shrink-0">
                                        <div className="text-[#203622] font-medium">
                                            {flag.doc_id}
                                        </div>
                                        <div className="text-sm text-gray-600 mt-0.5">
                                            {flag.name_first} {flag.name_last}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm text-gray-600">
                                                Attendance:
                                            </span>
                                            <span className="text-sm text-[#203622] font-medium">
                                                {flag.attendance_rate}%
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                ({flag.attended_sessions}/
                                                {flag.total_sessions} sessions)
                                            </span>
                                        </div>
                                        <Progress
                                            value={flag.attendance_rate}
                                            className="h-2 w-64 mb-2"
                                            indicatorClassName="bg-[#F1B51C]"
                                        />
                                        <div className="flex gap-4 text-xs text-gray-600">
                                            <span>
                                                Missed: {flag.missed_sessions}{' '}
                                                sessions
                                            </span>
                                            {flag.consecutive_absences > 0 && (
                                                <span className="text-amber-700 font-medium">
                                                    {flag.consecutive_absences}{' '}
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
