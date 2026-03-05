import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import useSWR, { KeyedMutator } from 'swr';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import {
    CancelEventReason,
    Class,
    ServerResponseMany
} from '@/types';
import {
    Instructor,
    InstructorClassData,
    BulkCancelSessionsRequest,
    BulkCancelSessionsResponse
} from '@/types/events';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { AlertCircle, Users, XCircle } from 'lucide-react';

interface BulkCancelClassesModalProps {
    open: boolean;
    onClose: () => void;
    mutate: KeyedMutator<ServerResponseMany<Class>>;
}

interface PreviewData {
    sessionCount: number;
    classCount: number;
    studentCount: number;
    classes: {
        classId: number;
        className: string;
        upcomingSessions: number;
        cancelledSessions: number;
        studentCount: number;
    }[];
}

export function BulkCancelClassesModal({
    open,
    onClose,
    mutate
}: BulkCancelClassesModalProps) {
    const { user } = useAuth();
    const facilityId = user?.facility?.id;

    const [selectedInstructor, setSelectedInstructor] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);

    const { data: instructorsResp } = useSWR<ServerResponseMany<Instructor>>(
        open && facilityId
            ? `/api/facilities/${facilityId}/instructors`
            : null
    );
    const instructors = useMemo(() => {
        const list = instructorsResp?.data ?? [];
        return list.filter((i) => i.id !== 0);
    }, [instructorsResp]);

    const isOther = reason === CancelEventReason['Other (add note)'];
    const finalReason = isOther ? customReason.trim() : reason;

    const canPreview =
        selectedInstructor &&
        dateRange.start &&
        dateRange.end &&
        reason &&
        (!isOther || customReason.trim());

    function resetState() {
        setSelectedInstructor('');
        setDateRange({ start: '', end: '' });
        setReason('');
        setCustomReason('');
        setShowConfirmation(false);
        setPreview(null);
        setLoading(false);
    }

    function handleClose() {
        resetState();
        onClose();
    }

    async function handlePreview() {
        if (!canPreview) return;
        setLoading(true);

        const resp = await API.get<InstructorClassData[]>(
            `instructors/${selectedInstructor}/classes?start_date=${dateRange.start}&end_date=${dateRange.end}`
        );

        setLoading(false);

        if (!resp.success) {
            toast.error(resp.message ?? 'Failed to fetch session data');
            return;
        }

        const classes: InstructorClassData[] = Array.isArray(resp.data) ? resp.data as InstructorClassData[] : [];
        const upcomingClasses = classes.filter(
            (c) => c.upcomingSessions > 0
        );
        const totalUpcoming = classes.reduce(
            (sum, c) => sum + c.upcomingSessions,
            0
        );

        if (totalUpcoming === 0) {
            toast.error(
                'No sessions found to cancel for the selected instructor and date range.'
            );
            return;
        }

        setPreview({
            sessionCount: totalUpcoming,
            classCount: upcomingClasses.length,
            studentCount: classes.reduce(
                (sum, c) => sum + c.enrolledCount,
                0
            ),
            classes: classes.map((c) => ({
                classId: c.id,
                className: c.name,
                upcomingSessions: c.upcomingSessions,
                cancelledSessions: c.cancelledSessions,
                studentCount: c.enrolledCount
            }))
        });
        setShowConfirmation(true);
    }

    async function handleConfirm() {
        if (!preview) return;
        toast.dismiss();
        setLoading(true);

        const request: BulkCancelSessionsRequest = {
            instructorId: Number(selectedInstructor),
            startDate: dateRange.start,
            endDate: dateRange.end,
            reason: finalReason
        };

        const resp = await API.post<BulkCancelSessionsResponse, BulkCancelSessionsRequest>(
            'program-classes/bulk-cancel',
            request
        );

        setLoading(false);

        if (resp.success) {
            const data = resp.data as BulkCancelSessionsResponse | undefined;
            if (data?.success) {
                const msg =
                    data.message ??
                    `Successfully cancelled ${data.sessionCount} session${data.sessionCount === 1 ? '' : 's'} across ${data.classCount} class${data.classCount === 1 ? '' : 'es'}.`;
                toast.success(msg);
                void mutate();
                handleClose();
            } else {
                toast.error(
                    'No sessions found to cancel for the selected instructor and date range.'
                );
            }
        } else {
            toast.error(resp.message ?? 'Failed to cancel sessions');
        }
    }

    const instructorName = useMemo(() => {
        if (!selectedInstructor) return '';
        const inst = instructors.find(
            (i) => i.id === Number(selectedInstructor)
        );
        return inst
            ? `${inst.name_first} ${inst.name_last}`
            : '';
    }, [selectedInstructor, instructors]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {!showConfirmation ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-[#203622]">
                                Cancel Classes by Instructor
                            </DialogTitle>
                            <DialogDescription>
                                Cancel all class sessions for a specific
                                instructor within a date range
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#203622]">
                                    Instructor{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={selectedInstructor}
                                    onValueChange={setSelectedInstructor}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an instructor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((inst) => (
                                            <SelectItem
                                                key={inst.id}
                                                value={String(inst.id)}
                                            >
                                                {inst.name_first}{' '}
                                                {inst.name_last}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-[#203622] mb-3 block">
                                    Date Range{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex gap-3">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-gray-600">
                                            From
                                        </Label>
                                        <Input
                                            type="date"
                                            value={dateRange.start}
                                            onChange={(e) =>
                                                setDateRange({
                                                    ...dateRange,
                                                    start: e.target.value
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-gray-600">
                                            To
                                        </Label>
                                        <Input
                                            type="date"
                                            value={dateRange.end}
                                            min={dateRange.start}
                                            onChange={(e) =>
                                                setDateRange({
                                                    ...dateRange,
                                                    end: e.target.value
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#203622]">
                                    Cancellation Reason{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={reason}
                                    onValueChange={setReason}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(CancelEventReason).map(
                                            (r) => (
                                                <SelectItem key={r} value={r}>
                                                    {r}
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isOther && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-[#203622]">
                                        Details{' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        value={customReason}
                                        onChange={(e) =>
                                            setCustomReason(e.target.value)
                                        }
                                        placeholder="Please provide details for the cancellation..."
                                        rows={3}
                                    />
                                </div>
                            )}

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => void handlePreview()}
                                    disabled={!canPreview || loading}
                                    className="bg-[#556830] hover:bg-[#203622] text-white"
                                >
                                    {loading
                                        ? 'Loading...'
                                        : 'Preview Cancellations'}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-[#203622] flex items-center gap-2">
                                <XCircle className="size-5 text-red-600" />
                                Confirm Bulk Cancellation
                            </DialogTitle>
                            <DialogDescription>
                                Review the sessions that will be cancelled
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            Instructor:
                                        </span>
                                        <span className="font-medium text-[#203622]">
                                            {instructorName}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            Date Range:
                                        </span>
                                        <span className="font-medium text-[#203622]">
                                            {new Date(
                                                dateRange.start
                                            ).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}{' '}
                                            -{' '}
                                            {new Date(
                                                dateRange.end
                                            ).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            Reason:
                                        </span>
                                        <span className="font-medium text-[#203622]">
                                            {finalReason}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-red-300">
                                        <span className="text-gray-600">
                                            Total Sessions:
                                        </span>
                                        <span className="font-bold text-red-700">
                                            {preview?.sessionCount ?? 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            Total Classes Affected:
                                        </span>
                                        <span className="font-bold text-red-700">
                                            {preview?.classCount ?? 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {preview && preview.classes.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-[#203622]">
                                        Affected Classes (
                                        {preview.classCount})
                                    </Label>
                                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
                                        {preview.classes
                                            .filter(
                                                (c) =>
                                                    c.upcomingSessions > 0
                                            )
                                            .map((cls) => (
                                                <div
                                                    key={cls.classId}
                                                    className="p-3 hover:bg-gray-50"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-[#203622] text-sm">
                                                            {cls.className}
                                                        </span>
                                                        <Badge className="bg-red-100 text-red-700 border-red-300">
                                                            {
                                                                cls.upcomingSessions
                                                            }{' '}
                                                            {cls.upcomingSessions ===
                                                            1
                                                                ? 'session'
                                                                : 'sessions'}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                        <Users className="size-3" />
                                                        <span>
                                                            {cls.studentCount}{' '}
                                                            enrolled
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-yellow-700 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-yellow-900">
                                        <strong>Warning:</strong> This action
                                        will cancel all selected sessions.
                                        Residents will need to be notified of
                                        these cancellations.
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setShowConfirmation(false)
                                    }
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={() => void handleConfirm()}
                                    disabled={loading}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <XCircle className="size-4 mr-2" />
                                    {loading
                                        ? 'Cancelling...'
                                        : 'Confirm Cancellation'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
