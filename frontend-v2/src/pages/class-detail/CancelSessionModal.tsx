import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import API from '@/api/api';
import { toast } from 'sonner';

export interface CancelFutureSession {
    date: string;
    eventId: number;
    classTime?: string;
}

interface CancelSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    eventId: number;
    date: string;
    classTime?: string;
    dateLabel: string;
    onCancelled: () => void;
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    futureSessions?: CancelFutureSession[];
}

export function CancelSessionModal({
    open,
    onClose,
    classId,
    eventId,
    date,
    classTime,
    dateLabel,
    onCancelled,
    applyToFuture,
    setApplyToFuture,
    futureSessions = []
}: CancelSessionModalProps) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setReason('');
            setNote('');
        }
    }, [open]);

    const canSubmit =
        reason && (reason !== 'other' || note.trim().length > 0);

    const handleCancel = async () => {
        setIsSubmitting(true);
        const cancelReason = reason === 'other' ? note.trim() : reason;

        const sessionsToCancel = [
            { date, eventId, classTime },
            ...(applyToFuture ? futureSessions : [])
        ];

        let ok = 0;
        let fail = 0;
        for (const s of sessionsToCancel) {
            const startTime = s.classTime?.split('-')[0];
            const resp = await API.patch(
                `program-classes/${classId}/events/${s.eventId}`,
                {
                    date: s.date,
                    start_time: startTime,
                    is_cancelled: true,
                    reason: cancelReason
                }
            );
            if (resp.success) ok++;
            else fail++;
        }

        if (ok) {
            toast.success(
                ok === 1
                    ? `Class on ${dateLabel} cancelled`
                    : `${ok} sessions cancelled`
            );
        }
        if (fail) {
            toast.error(`Failed to cancel ${fail} session${fail === 1 ? '' : 's'}`);
        }
        onClose();
        onCancelled();
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Cancel Class
                    </DialogTitle>
                    <DialogDescription>
                        Cancel the class scheduled for {dateLabel}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="cancel-reason">
                            Reason for Cancellation *
                        </Label>
                        <Select
                            value={reason}
                            onValueChange={(value) => {
                                setReason(value);
                                if (value !== 'other') {
                                    setNote('');
                                }
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="instructor_unavailable">
                                    Instructor Unavailable
                                </SelectItem>
                                <SelectItem value="instructor_illness">
                                    Instructor Illness
                                </SelectItem>
                                <SelectItem value="facility_issue_or_lockdown">
                                    Facility Issue or Lockdown
                                </SelectItem>
                                <SelectItem value="holiday_or_scheduled_break">
                                    Holiday or Scheduled Break
                                </SelectItem>
                                <SelectItem value="technology_issue">
                                    Technology Issue
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {reason === 'other' && (
                        <div className="space-y-2">
                            <Label htmlFor="cancel-note">
                                Please specify *
                            </Label>
                            <Textarea
                                id="cancel-note"
                                placeholder="Enter the specific reason for cancellation..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                            />
                        </div>
                    )}
                    {setApplyToFuture && (
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="apply-cancel-to-future"
                                checked={applyToFuture}
                                onChange={(e) =>
                                    setApplyToFuture(e.target.checked)
                                }
                                className="size-4 rounded border-gray-300"
                            />
                            <Label
                                htmlFor="apply-cancel-to-future"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Apply this change to all future sessions
                            </Label>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onClose();
                            setNote('');
                            setReason('');
                            if (setApplyToFuture) setApplyToFuture(false);
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleCancel();
                        }}
                        disabled={!canSubmit || isSubmitting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isSubmitting ? 'Cancelling...' : 'Cancel Class'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
