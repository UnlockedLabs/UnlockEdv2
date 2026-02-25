import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, Plus, Edit, MoreVertical, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { ClassEnrollment, EnrollmentStatus } from '@/types/attendance';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { getEnrollmentStatusColor } from '@/lib/formatters';
import { computeAttendanceByUser } from '@/lib/attendance-utils';
import API from '@/api/api';
import { toast } from 'sonner';
import { ChangeEnrollmentStatusModal } from './ChangeEnrollmentStatusModal';
import { UnenrollResidentModal } from './UnenrollResidentModal';
import { BulkGraduateModal } from './BulkGraduateModal';
import { EnrollResidentsModal } from './EnrollResidentsModal';

interface RosterTabProps {
    classId: number;
    classStatus: string;
    className: string;
    capacity: number;
    enrolled: number;
}

function getAllowedStatuses(classStatus: string, currentStatus: EnrollmentStatus): EnrollmentStatus[] {
    const allStatuses = Object.values(EnrollmentStatus).filter((s) => s !== currentStatus);
    if (classStatus === 'Completed' || classStatus === 'Cancelled') return [];
    if (classStatus === 'Scheduled') return allStatuses.filter((s) => s === EnrollmentStatus.Cancelled);
    if (classStatus === 'Active') return allStatuses.filter((s) => s !== EnrollmentStatus.Cancelled);
    return allStatuses;
}

export function RosterTab({ classId, classStatus, className, capacity, enrolled }: RosterTabProps) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [changingStatus, setChangingStatus] = useState<number | null>(null);
    const [statusModalEnrollment, setStatusModalEnrollment] =
        useState<ClassEnrollment | null>(null);
    const [unenrollTarget, setUnenrollTarget] = useState<ClassEnrollment | null>(null);
    const [showBulkGraduateModal, setShowBulkGraduateModal] = useState(false);
    const [showEnrollModal, setShowEnrollModal] = useState(false);

    const enrollmentStatus =
        statusFilter === 'all' ? EnrollmentStatus.Enrolled : statusFilter;
    const { data: enrollmentResp, mutate } = useSWR<
        ServerResponseMany<ClassEnrollment>
    >(
        `/api/program-classes/${classId}/enrollments?status=${encodeURIComponent(enrollmentStatus)}`
    );

    const { data: eventsResp } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${classId}/events?all=true`);

    const enrolledRows = enrollmentResp?.data ?? [];

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
        const enrollmentIds = Array.from(selectedIds);
        const userIds = enrolledRows
            .filter((e) => enrollmentIds.includes(e.id))
            .map((e) => e.user_id);
        const resp = await API.patch<
            unknown,
            { enrollment_status: string; user_ids: number[] }
        >(`program-classes/${classId}/enrollments`, {
            enrollment_status: EnrollmentStatus.Completed,
            user_ids: userIds
        });
        if (resp.success) {
            toast.success(
                `${userIds.length} ${userIds.length === 1 ? 'resident' : 'residents'} graduated successfully`
            );
            setSelectedIds(new Set());
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to graduate residents');
        }
    };

    const handleStatusChange = async (
        enrollment: ClassEnrollment,
        newStatus: EnrollmentStatus,
        reason: string
    ) => {
        setChangingStatus(enrollment.id);
        const body: {
            enrollment_status: string;
            user_ids: number[];
            change_reason?: string;
        } = {
            enrollment_status: newStatus,
            user_ids: [enrollment.user_id]
        };
        if (reason.trim()) {
            body.change_reason = reason.trim();
        }
        const resp = await API.patch<unknown, typeof body>(
            `program-classes/${classId}/enrollments`,
            body
        );
        if (resp.success) {
            toast.success(`Status updated to ${newStatus}`);
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to update status');
        }
        setChangingStatus(null);
    };

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
                            className="border-gray-300 self-start sm:self-auto sm:ml-0"
                            onClick={() => setShowEnrollModal(true)}
                        >
                            <Plus className="size-4 mr-2" />
                            Enroll Resident
                        </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by resident ID or name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 w-full"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        >
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Enrolled (default)
                                </SelectItem>
                                {Object.values(EnrollmentStatus).map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            ) ?? { attended: 0, total: 0, rate: 0 };
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
                                            <div className="w-[100px] sm:w-[140px] shrink-0">
                                                <div className="text-[#203622] font-medium">
                                                    {enrollment.doc_id}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-0.5 truncate">
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
                                        <div className="flex items-center gap-2 sm:gap-3 sm:ml-0 flex-wrap">
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
                                            {(() => {
                                                const allowed = getAllowedStatuses(classStatus, enrollment.enrollment_status);
                                                if (allowed.length === 0) {
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className={getEnrollmentStatusColor(enrollment.enrollment_status)}
                                                        >
                                                            {enrollment.enrollment_status}
                                                        </Badge>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        className="group"
                                                        disabled={changingStatus === enrollment.id}
                                                        onClick={() => setStatusModalEnrollment(enrollment)}
                                                    >
                                                        <Badge
                                                            variant="outline"
                                                            className={`${getEnrollmentStatusColor(enrollment.enrollment_status)} cursor-pointer transition-all hover:shadow-sm hover:ring-2 hover:ring-[#556830]/20 flex items-center gap-1.5`}
                                                        >
                                                            {changingStatus === enrollment.id
                                                                ? 'Updating...'
                                                                : enrollment.enrollment_status}
                                                            <Edit className="size-3 text-current opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        </Badge>
                                                    </button>
                                                );
                                            })()}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-gray-100 h-8 w-8 p-0">
                                                    <MoreVertical className="size-4" />
                                                    <span className="sr-only">
                                                        Resident actions
                                                    </span>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="z-[100]"
                                                >
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            setStatusModalEnrollment(
                                                                enrollment
                                                            )
                                                        }
                                                    >
                                                        <Edit className="size-4 mr-2" />
                                                        Change Status
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            navigate(
                                                                `/program-classes/${classId}/enrollments`
                                                            )
                                                        }
                                                    >
                                                        View Attendance History
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    onClick={() =>
                                                                        setUnenrollTarget(
                                                                            enrollment
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        stats.total >
                                                                        0
                                                                    }
                                                                >
                                                                    <UserMinus className="size-4 mr-2" />
                                                                    Unenroll
                                                                    Resident
                                                                </DropdownMenuItem>
                                                            </div>
                                                        </TooltipTrigger>
                                                        {stats.total > 0 && (
                                                            <TooltipContent side="left">
                                                                Cannot unenroll
                                                                after attendance
                                                                has been taken
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg px-4 sm:px-6 py-4 z-50 max-w-[calc(100vw-2rem)]">
                    <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
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
                                onClick={() => setShowBulkGraduateModal(true)}
                            >
                                <CheckCircle className="size-4 mr-2" />
                                Graduate Selected
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {statusModalEnrollment && (
                <ChangeEnrollmentStatusModal
                    open={!!statusModalEnrollment}
                    onClose={() => setStatusModalEnrollment(null)}
                    residentDisplayId={statusModalEnrollment.doc_id ?? ''}
                    residentName={statusModalEnrollment.name_full ?? ''}
                    currentStatus={statusModalEnrollment.enrollment_status}
                    allowedStatuses={getAllowedStatuses(
                        classStatus,
                        statusModalEnrollment.enrollment_status
                    )}
                    onStatusChange={(newStatus, reason) =>
                        handleStatusChange(
                            statusModalEnrollment,
                            newStatus,
                            reason
                        )
                    }
                />
            )}

            {unenrollTarget && (
                <UnenrollResidentModal
                    open={!!unenrollTarget}
                    onClose={() => setUnenrollTarget(null)}
                    classId={classId}
                    userId={unenrollTarget.user_id}
                    residentDisplayId={unenrollTarget.doc_id ?? ''}
                    residentName={unenrollTarget.name_full ?? ''}
                    onUnenrolled={() => void mutate()}
                />
            )}

            <BulkGraduateModal
                open={showBulkGraduateModal}
                onClose={() => setShowBulkGraduateModal(false)}
                count={selectedIds.size}
                onConfirm={handleBulkGraduate}
            />

            <EnrollResidentsModal
                open={showEnrollModal}
                onOpenChange={setShowEnrollModal}
                classId={classId}
                className={className}
                capacity={capacity}
                enrolled={enrolled}
                onEnrolled={() => void mutate()}
            />
        </div>
    );
}
