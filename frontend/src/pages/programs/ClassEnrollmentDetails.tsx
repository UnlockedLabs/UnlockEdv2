import { useState, startTransition } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Plus, Search, GraduationCap } from 'lucide-react';
import API from '@/api/api';
import {
    Class,
    ClassLoaderData,
    ClassEnrollment,
    EnrollmentStatus,
    SelectedClassStatus,
    ServerResponseMany,
    ProgramCompletion,
    FilterResidentNames
} from '@/types';
import { getEnrollmentStatusColor } from '@/lib/formatters';
import { isCompletedCancelledOrArchived } from '@/lib/classStatus';
import { ConfirmDialog, FormModal } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

interface StatusChange {
    name_full: string;
    user_id: number;
    status: string;
}

const ENROLLMENT_STATUS_OPTIONS: Record<string, string> = {
    Enrolled: 'Enrolled',
    Cancelled: 'Cancelled',
    Completed: 'Completed',
    Withdrawn: 'Incomplete: Withdrawn',
    Dropped: 'Incomplete: Dropped',
    'Segregated - Dropped': 'Incomplete: Segregated',
    'Failed To Complete': 'Incomplete: Failed to Complete'
};

function requiresReason(status?: string): boolean {
    return [
        'incomplete: withdrawn',
        'incomplete: dropped',
        'incomplete: failed to complete'
    ].includes(status?.toLowerCase() ?? '');
}

export default function ClassEnrollmentDetails() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const loaderData = useLoaderData() as ClassLoaderData;
    const clsInfo = loaderData?.class;
    const blockEdits = isCompletedCancelledOrArchived(clsInfo ?? ({} as Class));

    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<string>(FilterResidentNames['Resident Name (A-Z)']);
    const [viewMode, setViewMode] = useState<'enrolled' | 'other'>('enrolled');
    const [filterStatus, setFilterStatus] = useState('all');
    const [page, setPage] = useState(1);
    const perPage = 20;
    const [selectedResidents, setSelectedResidents] = useState<number[]>([]);
    const [changeStatusValue, setChangeStatusValue] = useState<StatusChange>();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reason, setReason] = useState('');

    function getStatusParam(): string {
        if (viewMode === 'enrolled') return 'enrolled';
        if (filterStatus === 'all' || filterStatus === '') return 'not_enrolled';
        return filterStatus;
    }

    const status = getStatusParam();
    const { data, isLoading, mutate } = useSWR<ServerResponseMany<ClassEnrollment>>(
        `/api/program-classes/${class_id}/enrollments?search=${searchTerm}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&status=${status}`
    );

    const otherStatus = viewMode === 'enrolled' ? 'not_enrolled' : 'enrolled';
    const { data: otherData, mutate: mutateOther } = useSWR<ServerResponseMany<ClassEnrollment>>(
        `/api/program-classes/${class_id}/enrollments?per_page=1&status=${otherStatus}`
    );

    const enrollments = data?.data ?? [];
    const meta = data?.meta;
    const enrolledCount = viewMode === 'enrolled' ? meta?.total ?? 0 : otherData?.meta?.total ?? 0;
    const otherCount = viewMode === 'enrolled' ? otherData?.meta?.total ?? 0 : meta?.total ?? 0;
    const totalPages = meta ? meta.last_page : 1;

    async function refreshEnrollments() {
        await Promise.all([mutate(), mutateOther()]);
    }

    function handleViewModeChange(mode: 'enrolled' | 'other') {
        setViewMode(mode);
        setPage(1);
        setSelectedResidents([]);
        setFilterStatus('all');
    }

    function handleSearch(term: string) {
        startTransition(() => {
            setSearchTerm(term);
            setPage(1);
        });
    }

    function handleStatusChange(value: string, enrollment: ClassEnrollment) {
        setSelectedResidents([]);
        setChangeStatusValue({
            status: value,
            user_id: enrollment.user_id,
            name_full: enrollment.name_full
        });
        if (requiresReason(value)) {
            setReason('');
            setShowReasonModal(true);
        } else {
            setShowConfirmDialog(true);
        }
    }

    function handleToggleSelection(userId: number) {
        setSelectedResidents((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    }

    function handleSelectAll() {
        const selectable = enrollments.filter(
            (e) => !e.completion_dt && e.enrollment_status === EnrollmentStatus.Enrolled
        );
        if (selectedResidents.length === selectable.length) {
            setSelectedResidents([]);
        } else {
            setSelectedResidents(selectable.map((e) => e.user_id));
        }
    }

    function handleGraduateSelected() {
        if (selectedResidents.length === 0) return;
        setChangeStatusValue({
            status: EnrollmentStatus.Completed,
            user_id: selectedResidents[0],
            name_full:
                selectedResidents.length > 1
                    ? `${selectedResidents.length} Residents`
                    : enrollments.find((e) => e.user_id === selectedResidents[0])?.name_full ?? ''
        });
        setShowConfirmDialog(true);
    }

    async function submitEnrollmentChange(reasonText?: string) {
        if (!changeStatusValue) return;
        const resp = await API.patch(`program-classes/${class_id}/enrollments`, {
            enrollment_status: changeStatusValue.status,
            user_ids: selectedResidents.length > 0 ? selectedResidents : [changeStatusValue.user_id],
            ...(requiresReason(changeStatusValue.status) && {
                change_reason: reasonText?.trim()
            })
        });

        if (resp.success) {
            setSelectedResidents([]);
            setChangeStatusValue(undefined);
            toast.success('Enrollment status updated');
            await refreshEnrollments();
        } else {
            toast.error("Unable to update resident's enrollment status");
        }
        setShowConfirmDialog(false);
        setShowReasonModal(false);
    }

    const allSelected =
        enrollments.length > 0 &&
        enrollments.filter((e) => !e.completion_dt && e.enrollment_status === EnrollmentStatus.Enrolled)
            .length === selectedResidents.length &&
        selectedResidents.length > 0;

    function getFilteredStatusOptions(): Record<string, string> {
        if (clsInfo?.status === SelectedClassStatus.Scheduled) {
            return { Enrolled: 'Enrolled', Cancelled: 'Cancelled' };
        }
        if (clsInfo?.status === SelectedClassStatus.Active) {
            const { Cancelled: _, ...rest } = ENROLLMENT_STATUS_OPTIONS;
            return rest;
        }
        return ENROLLMENT_STATUS_OPTIONS;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-md border border-border">
                        <Button
                            variant={viewMode === 'enrolled' ? 'default' : 'ghost'}
                            size="sm"
                            className={
                                viewMode === 'enrolled'
                                    ? 'bg-[#556830] text-white hover:bg-[#203622] rounded-r-none'
                                    : 'rounded-r-none'
                            }
                            onClick={() => handleViewModeChange('enrolled')}
                        >
                            Enrolled ({enrolledCount})
                        </Button>
                        <Button
                            variant={viewMode === 'other' ? 'default' : 'ghost'}
                            size="sm"
                            className={
                                viewMode === 'other'
                                    ? 'bg-[#556830] text-white hover:bg-[#203622] rounded-l-none'
                                    : 'rounded-l-none'
                            }
                            onClick={() => handleViewModeChange('other')}
                        >
                            Graduated/Other ({otherCount})
                        </Button>
                    </div>

                    <div className="relative w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Select value={sortQuery} onValueChange={(v) => { setSortQuery(v); setPage(1); }}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name_last asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name_last desc">Name (Z-A)</SelectItem>
                            <SelectItem value="doc_id asc">Resident ID (Asc)</SelectItem>
                            <SelectItem value="doc_id desc">Resident ID (Desc)</SelectItem>
                            <SelectItem value="start_dt asc">Enrollment (Asc)</SelectItem>
                            <SelectItem value="start_dt desc">Enrollment (Desc)</SelectItem>
                        </SelectContent>
                    </Select>

                    {viewMode === 'other' && (
                        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="incomplete: withdrawn">Withdrawn</SelectItem>
                                <SelectItem value="incomplete: dropped">Dropped</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {selectedResidents.length > 0 && clsInfo?.status === SelectedClassStatus.Active && (
                        <Button
                            onClick={handleGraduateSelected}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            <GraduationCap className="size-4 mr-1" />
                            Graduate Selected
                        </Button>
                    )}
                    <Button
                        disabled={blockEdits}
                        onClick={() => navigate(`/program-classes/${class_id}/enrollments/add`)}
                        className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                    >
                        <Plus className="size-4" />
                        Add Resident
                    </Button>
                </div>
            </div>

            <div className="bg-card rounded-lg border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {viewMode === 'enrolled' && (
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                            )}
                            <TableHead>Name</TableHead>
                            <TableHead>Resident ID</TableHead>
                            <TableHead>Enrollment Date</TableHead>
                            <TableHead>Status</TableHead>
                            {viewMode === 'enrolled' && !blockEdits && (
                                <TableHead>Action</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : enrollments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No enrollments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            enrollments.map((enrollment) => {
                                const isSelected = selectedResidents.includes(enrollment.user_id);
                                const canToggle =
                                    !enrollment.completion_dt &&
                                    enrollment.enrollment_status === EnrollmentStatus.Enrolled;

                                return (
                                    <TableRow key={enrollment.id}>
                                        {viewMode === 'enrolled' && (
                                            <TableCell>
                                                {canToggle && (
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() =>
                                                            handleToggleSelection(enrollment.user_id)
                                                        }
                                                    />
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell className="font-medium text-foreground">
                                            {enrollment.name_full}
                                        </TableCell>
                                        <TableCell>{enrollment.doc_id}</TableCell>
                                        <TableCell>
                                            {enrollment.enrolled_at
                                                ? new Date(enrollment.enrolled_at).toLocaleDateString()
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={getEnrollmentStatusColor(
                                                    enrollment.enrollment_status
                                                )}
                                            >
                                                {enrollment.enrollment_status}
                                            </Badge>
                                        </TableCell>
                                        {viewMode === 'enrolled' && !blockEdits && (
                                            <TableCell>
                                                {enrollment.enrollment_status === EnrollmentStatus.Enrolled &&
                                                    !enrollment.completion_dt && (
                                                        <Select
                                                            onValueChange={(v) =>
                                                                handleStatusChange(v, enrollment)
                                                            }
                                                        >
                                                            <SelectTrigger className="w-36 h-8">
                                                                <SelectValue placeholder="Change status" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Object.entries(getFilteredStatusOptions())
                                                                    .filter(([key]) => key !== 'Enrolled')
                                                                    .map(([label, value]) => (
                                                                        <SelectItem key={label} value={value}>
                                                                            {label}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                            Next
                        </Button>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                title="Confirm Enrollment Action"
                description={`Are you sure you want to permanently change the status to "${changeStatusValue?.status}" for ${changeStatusValue?.name_full ?? 'the selected users'}? This cannot be undone.`}
                confirmLabel="Confirm"
                onConfirm={() => void submitEnrollmentChange()}
                variant="destructive"
            />

            <FormModal
                open={showReasonModal}
                onOpenChange={(open) => {
                    setShowReasonModal(open);
                    if (!open) setChangeStatusValue(undefined);
                }}
                title="Confirm Enrollment Action"
                description={`Please add the reason for changing ${changeStatusValue?.name_full}'s status to ${changeStatusValue?.status}`}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="Enter reason..."
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowReasonModal(false);
                                setChangeStatusValue(undefined);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!reason.trim()}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                            onClick={() => void submitEnrollmentChange(reason)}
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </FormModal>
        </div>
    );
}
