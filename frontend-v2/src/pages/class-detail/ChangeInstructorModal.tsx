import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useAuth } from '@/auth/useAuth';
import API from '@/api/api';
import { toast } from 'sonner';
import { User, ServerResponseMany } from '@/types';

export interface ChangeInstructorSession {
    date: string;
    dateLabel: string;
    eventId: number;
    classTime: string;
    dateObj?: Date;
    dayName?: string;
}

interface ChangeInstructorModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    sessions: ChangeInstructorSession[];
    onChanged: () => void;
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    futureSessions?: ChangeInstructorSession[];
    showSessionsList?: boolean;
}

export function ChangeInstructorModal({
    open,
    onClose,
    classId,
    sessions,
    onChanged,
    applyToFuture,
    setApplyToFuture,
    futureSessions = [],
    showSessionsList = false
}: ChangeInstructorModalProps) {
    const { user } = useAuth();
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: instructorsResp } = useSWR<ServerResponseMany<User>>(
        open && user ? `/api/users?role=${user.role}&per_page=100` : null
    );
    const instructors = instructorsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setSelectedInstructorId('');
            setReason('');
        }
    }, [open]);

    const handleApply = async () => {
        if (!selectedInstructorId) return;
        setIsSubmitting(true);
        let ok = 0;
        let fail = 0;

        for (const s of sessions) {
            const resp = await API.patch(
                `program-classes/${classId}/events/${s.eventId}`,
                {
                    date: s.date,
                    is_cancelled: false,
                    instructor_id: Number(selectedInstructorId)
                }
            );
            if (resp.success) ok++;
            else fail++;
        }

        if (ok)
            toast.success(
                `Instructor updated for ${ok} session${ok === 1 ? '' : 's'}`
            );
        if (fail)
            toast.error(
                `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
            );
        onClose();
        onChanged();
        setIsSubmitting(false);
    };

    const useBulkLayout = showSessionsList || sessions.length > 1;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className={useBulkLayout ? 'max-w-2xl' : ''}>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Instructor
                    </DialogTitle>
                    <DialogDescription>
                        {useBulkLayout
                            ? `Select a new instructor for ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`
                            : `Change the instructor for the class scheduled for ${sessions[0]?.dateLabel}`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="newInstructor">New Instructor</Label>
                        <Select
                            value={selectedInstructorId}
                            onValueChange={setSelectedInstructorId}
                        >
                            <SelectTrigger id="newInstructor">
                                <SelectValue placeholder="Select instructor" />
                            </SelectTrigger>
                            <SelectContent>
                                {instructors.map((inst) => (
                                    <SelectItem
                                        key={inst.id}
                                        value={String(inst.id)}
                                    >
                                        {inst.name_first} {inst.name_last}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="change-reason">
                            Reason for Change
                        </Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="change-reason">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="instructor_unavailable">
                                    Instructor Unavailable
                                </SelectItem>
                                <SelectItem value="instructor_illness">
                                    Instructor Illness
                                </SelectItem>
                                <SelectItem value="scheduling_conflict">
                                    Scheduling Conflict
                                </SelectItem>
                                <SelectItem value="personal_emergency">
                                    Personal Emergency
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {setApplyToFuture && (
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="apply-instructor-to-future"
                                checked={applyToFuture}
                                onChange={(e) =>
                                    setApplyToFuture(e.target.checked)
                                }
                                className="size-4 rounded border-gray-300"
                            />
                            <Label
                                htmlFor="apply-instructor-to-future"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Apply this change to all future sessions
                            </Label>
                        </div>
                    )}

                    {applyToFuture && futureSessions.length > 0 && (
                        <div>
                            <Label className="text-sm font-medium text-[#203622] mb-2 block">
                                Sessions to Update
                            </Label>
                            <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                                {[...futureSessions]
                                    .sort(
                                        (a, b) =>
                                            (a.dateObj?.getTime() ?? 0) -
                                            (b.dateObj?.getTime() ?? 0)
                                    )
                                    .map((sess) => (
                                        <div
                                            key={sess.date}
                                            className="text-sm text-gray-700"
                                        >
                                            {sess.dayName ?? ''},{' '}
                                            {sess.dateObj?.toLocaleDateString(
                                                'en-US',
                                                {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }
                                            ) ?? sess.dateLabel}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {useBulkLayout && sessions.length > 0 && (
                        <div>
                            <Label className="text-sm font-medium text-[#203622] mb-2 block">
                                Sessions to Update
                            </Label>
                            <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                                {[...sessions]
                                    .sort(
                                        (a, b) =>
                                            (a.dateObj?.getTime() ?? 0) -
                                            (b.dateObj?.getTime() ?? 0)
                                    )
                                    .map((s) => (
                                        <div
                                            key={s.date}
                                            className="text-sm text-gray-700"
                                        >
                                            {s.dayName ?? ''},{' '}
                                            {s.dateObj?.toLocaleDateString(
                                                'en-US',
                                                {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }
                                            ) ?? s.dateLabel}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onClose();
                            setSelectedInstructorId('');
                            setReason('');
                            if (setApplyToFuture) setApplyToFuture(false);
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleApply();
                        }}
                        disabled={!selectedInstructorId || isSubmitting}
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        {isSubmitting ? 'Updating...' : 'Change Instructor'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
