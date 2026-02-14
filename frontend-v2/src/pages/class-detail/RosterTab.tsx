import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
    ClassEnrollment,
    EnrollmentAttendance,
    EnrollmentStatus
} from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';
import { getEnrollmentStatusColor } from '@/lib/formatters';
import API from '@/api/api';
import { toast } from 'sonner';

interface RosterTabProps {
    classId: number;
    enrollments: ClassEnrollment[];
}

interface ResidentRow {
    enrollment: ClassEnrollment;
    attendanceRate: number;
    attendedSessions: number;
    totalSessions: number;
    needsSupport: boolean;
}

function computeResidentRows(
    enrollments: ClassEnrollment[],
    attendanceRecords: EnrollmentAttendance[]
): ResidentRow[] {
    const enrolled = enrollments.filter(
        (e) => e.enrollment_status === EnrollmentStatus.Enrolled
    );

    const recordsByUser = new Map<number, EnrollmentAttendance[]>();
    for (const r of attendanceRecords) {
        const existing = recordsByUser.get(r.user_id) ?? [];
        existing.push(r);
        recordsByUser.set(r.user_id, existing);
    }

    return enrolled.map((enrollment) => {
        const records = recordsByUser.get(enrollment.user_id) ?? [];
        const withStatus = records.filter((r) => r.attendance_status);
        const total = withStatus.length;
        const attended = withStatus.filter(
            (r) =>
                r.attendance_status === 'present' ||
                r.attendance_status === 'partial'
        ).length;

        const rate = total > 0 ? Math.round((attended / total) * 100) : 100;
        return {
            enrollment,
            attendanceRate: rate,
            attendedSessions: attended,
            totalSessions: total,
            needsSupport: rate < 75
        };
    });
}

export function RosterTab({ classId, enrollments }: RosterTabProps) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showStatusChangeFor, setShowStatusChangeFor] = useState<number | null>(null);

    const { data: attendanceResp, mutate } = useSWR<
        ServerResponseMany<EnrollmentAttendance>
    >(`/api/program-classes/${classId}/enrollments`);

    const rows = useMemo(() => {
        return computeResidentRows(
            enrollments,
            attendanceResp?.data ?? []
        );
    }, [enrollments, attendanceResp]);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter(
            (r) =>
                r.enrollment.doc_id.toLowerCase().includes(q) ||
                r.enrollment.name_full.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const toggleSelection = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredRows.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRows.map((r) => r.enrollment.id)));
        }
    };

    const handleBulkGraduate = async () => {
        const ids = Array.from(selectedIds);
        const resp = await API.patch<
            unknown,
            { enrollment_ids: number[]; status: string }
        >(`program-classes/${classId}/enrollments`, {
            enrollment_ids: ids,
            status: EnrollmentStatus.Completed
        });
        if (resp.success) {
            toast.success(
                `${ids.length} ${ids.length === 1 ? 'resident' : 'residents'} graduated successfully`
            );
            setSelectedIds(new Set());
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to graduate residents');
        }
    };

    const handleStatusChange = async (
        enrollmentId: number,
        newStatus: EnrollmentStatus,
        reason?: string
    ) => {
        const resp = await API.patch<
            unknown,
            { enrollment_ids: number[]; status: string; change_reason?: string }
        >(`program-classes/${classId}/enrollments`, {
            enrollment_ids: [enrollmentId],
            status: newStatus,
            change_reason: reason
        });
        if (resp.success) {
            toast.success(`Enrollment status updated to ${newStatus}`);
            setShowStatusChangeFor(null);
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to update status');
        }
    };

    void handleStatusChange;
    void showStatusChangeFor;
    void setShowStatusChangeFor;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <Checkbox
                                checked={
                                    selectedIds.size === filteredRows.length &&
                                    filteredRows.length > 0
                                }
                                onCheckedChange={toggleAll}
                                aria-label="Select all residents"
                            />
                            <div>
                                <h3 className="text-[#203622] font-semibold">
                                    Enrolled Residents ({rows.length})
                                    {selectedIds.size > 0 && (
                                        <span className="ml-2 text-[#556830] font-normal">
                                            - {selectedIds.size} selected
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    View enrollment and track engagement
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="border-gray-300"
                            onClick={() =>
                                navigate(
                                    `/program-classes/${classId}/enrollments/add`
                                )
                            }
                        >
                            <Plus className="size-4 mr-2" />
                            Enroll Resident
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Search by resident ID or name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 w-full"
                        />
                    </div>
                </div>
                <div className="divide-y divide-gray-200">
                    {filteredRows.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Search className="size-12 mx-auto mb-3 text-gray-300" />
                            <p>No residents found</p>
                            <p className="text-sm mt-1">
                                Try adjusting your search
                            </p>
                        </div>
                    ) : (
                        filteredRows.map((row) => (
                            <div
                                key={row.enrollment.id}
                                className="px-6 py-4 hover:bg-[#E2E7EA]/30 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6 flex-1">
                                        <Checkbox
                                            checked={selectedIds.has(
                                                row.enrollment.id
                                            )}
                                            onCheckedChange={() =>
                                                toggleSelection(
                                                    row.enrollment.id
                                                )
                                            }
                                            aria-label={`Select ${row.enrollment.doc_id}`}
                                            className="shrink-0"
                                        />
                                        <div className="min-w-[80px]">
                                            <div className="text-[#203622] font-medium">
                                                {row.enrollment.doc_id}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-0.5">
                                                {row.enrollment.name_full}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-sm text-gray-600">
                                                    Attendance:
                                                </span>
                                                <span className="text-sm text-[#203622] font-medium">
                                                    {row.attendanceRate}%
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    ({row.attendedSessions}/
                                                    {row.totalSessions}{' '}
                                                    sessions)
                                                </span>
                                            </div>
                                            <Progress
                                                value={row.attendanceRate}
                                                className="h-2 w-64"
                                                indicatorClassName={
                                                    row.needsSupport
                                                        ? 'bg-[#F1B51C]'
                                                        : 'bg-[#556830]'
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {row.enrollment.enrolled_at && (
                                            <span className="text-sm text-gray-600">
                                                Enrolled:{' '}
                                                {new Date(
                                                    row.enrollment.enrolled_at
                                                ).toLocaleDateString()}
                                            </span>
                                        )}
                                        {row.needsSupport && (
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-50 text-amber-700 border-amber-200"
                                            >
                                                Needs Support
                                            </Badge>
                                        )}
                                        <Badge
                                            variant="outline"
                                            className={`${getEnrollmentStatusColor(row.enrollment.enrollment_status)} cursor-pointer transition-all hover:shadow-sm hover:ring-2 hover:ring-[#556830]/20 flex items-center gap-1.5`}
                                        >
                                            {row.enrollment.enrollment_status}
                                            <Edit className="size-3 text-current opacity-60" />
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg px-6 py-4 z-50">
                    <div className="flex items-center gap-6">
                        <div className="text-sm">
                            <span className="font-semibold text-[#203622]">
                                {selectedIds.size}
                            </span>
                            <span className="text-gray-600 ml-1">
                                {selectedIds.size === 1
                                    ? 'resident'
                                    : 'residents'}{' '}
                                selected
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Clear Selection
                            </Button>
                            <Button
                                size="sm"
                                className="bg-[#556830] hover:bg-[#203622]"
                                onClick={handleBulkGraduate}
                            >
                                <CheckCircle className="size-4 mr-2" />
                                Graduate Selected
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
