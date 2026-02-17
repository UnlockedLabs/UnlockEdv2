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
    EnrollmentStatus
} from '@/types/attendance';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { getEnrollmentStatusColor } from '@/lib/formatters';
import API from '@/api/api';
import { toast } from 'sonner';

interface RosterTabProps {
    classId: number;
}

interface AttendanceStats {
    attended: number;
    total: number;
    rate: number;
}

function computeAttendanceByUser(
    instances: ClassEventInstance[]
): Map<number, AttendanceStats> {
    const byUser = new Map<number, { attended: number; total: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const inst of instances) {
        if (inst.is_cancelled) continue;
        const instDate = new Date(inst.date);
        instDate.setHours(0, 0, 0, 0);
        if (instDate > today) continue;

        for (const record of inst.attendance_records ?? []) {
            const existing = byUser.get(record.user_id) ?? {
                attended: 0,
                total: 0
            };
            existing.total++;
            if (
                record.attendance_status === 'present' ||
                record.attendance_status === 'partial'
            ) {
                existing.attended++;
            }
            byUser.set(record.user_id, existing);
        }
    }

    const result = new Map<number, AttendanceStats>();
    byUser.forEach((stats, userId) => {
        result.set(userId, {
            ...stats,
            rate:
                stats.total > 0
                    ? Math.round((stats.attended / stats.total) * 100)
                    : 100
        });
    });
    return result;
}

export function RosterTab({ classId }: RosterTabProps) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showStatusChangeFor, setShowStatusChangeFor] = useState<
        number | null
    >(null);

    const { data: enrollmentResp, mutate } = useSWR<
        ServerResponseMany<ClassEnrollment>
    >(`/api/program-classes/${classId}/enrollments`);

    const { data: eventsResp } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${classId}/events`);

    const enrolledRows = useMemo(() => {
        return (enrollmentResp?.data ?? []).filter(
            (e) => e.enrollment_status === EnrollmentStatus.Enrolled
        );
    }, [enrollmentResp]);

    const attendanceMap = useMemo(() => {
        return computeAttendanceByUser(eventsResp?.data ?? []);
    }, [eventsResp]);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return enrolledRows;
        const q = search.toLowerCase();
        return enrolledRows.filter(
            (r) =>
                r.doc_id?.toLowerCase().includes(q) ||
                r.name_full?.toLowerCase().includes(q)
        );
    }, [enrolledRows, search]);

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
            setSelectedIds(new Set(filteredRows.map((r) => r.id)));
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
            {
                enrollment_ids: number[];
                status: string;
                change_reason?: string;
            }
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
                <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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
                                    Enrolled Residents ({enrolledRows.length})
                                    {selectedIds.size > 0 && (
                                        <span className="ml-2 text-[#556830] font-normal">
                                            - {selectedIds.size} selected
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    View enrollment and track engagement
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="border-gray-300 self-start sm:self-auto ml-7 sm:ml-0"
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
                            <Search className="size-12 mx-auto mb-3 text-gray-400" />
                            <p>No residents found</p>
                            <p className="text-sm mt-1">
                                Try adjusting your search
                            </p>
                        </div>
                    ) : (
                        filteredRows.map((enrollment) => {
                            const stats = attendanceMap.get(
                                enrollment.user_id
                            ) ?? { attended: 0, total: 0, rate: 100 };
                            const needsSupport = stats.rate < 75;

                            return (
                                <div
                                    key={enrollment.id}
                                    className="px-4 sm:px-6 py-4 hover:bg-[#E2E7EA]/30 transition-colors"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
                                        <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
                                            <Checkbox
                                                checked={selectedIds.has(
                                                    enrollment.id
                                                )}
                                                onCheckedChange={() =>
                                                    toggleSelection(
                                                        enrollment.id
                                                    )
                                                }
                                                aria-label={`Select ${enrollment.doc_id}`}
                                                className="shrink-0"
                                            />
                                            <div className="min-w-[100px] shrink-0">
                                                <div className="text-[#203622] font-medium">
                                                    {enrollment.doc_id}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-0.5">
                                                    {enrollment.name_full}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0 hidden md:block">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-sm text-gray-600">
                                                        Attendance:
                                                    </span>
                                                    <span className="text-sm text-[#203622] font-medium">
                                                        {stats.rate}%
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        ({stats.attended}/
                                                        {stats.total} sessions)
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={stats.rate}
                                                    className="h-2 max-w-64 bg-gray-200"
                                                    indicatorClassName={
                                                        needsSupport
                                                            ? 'bg-[#F1B51C]'
                                                            : 'bg-[#556830]'
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 ml-7 sm:ml-0 flex-wrap">
                                            <span className="text-sm text-gray-500">
                                                Enrolled:{' '}
                                                {new Date(
                                                    enrollment.enrolled_at ??
                                                        enrollment.created_at
                                                ).toLocaleDateString(
                                                    'en-CA'
                                                )}
                                            </span>
                                            {needsSupport && (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-amber-50 text-amber-700 border-amber-200"
                                                >
                                                    Needs Support
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className={`${getEnrollmentStatusColor(enrollment.enrollment_status)} cursor-pointer transition-all hover:shadow-sm hover:ring-2 hover:ring-[#556830]/20 flex items-center gap-1.5`}
                                            >
                                                {enrollment.enrollment_status}
                                                <Edit className="size-3 text-current opacity-60" />
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
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
                            <span className="text-gray-500 ml-1">
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
