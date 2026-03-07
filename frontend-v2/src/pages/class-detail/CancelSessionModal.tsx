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

const CANCEL_REASONS = [
    { value: 'instructor_unavailable', label: 'Instructor Unavailable' },
    { value: 'instructor_illness', label: 'Instructor Illness' },
    {
        value: 'facility_issue_or_lockdown',
        label: 'Facility Issue or Lockdown'
    },
    {
        value: 'holiday_or_scheduled_break',
        label: 'Holiday or Scheduled Break'
    },
    { value: 'technology_issue', label: 'Technology Issue' },
    { value: 'other', label: 'Other' }
];

interface CancelSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    eventId: number;
    date: string;
    dateLabel: string;
    onCancelled: () => void;
}

export function CancelSessionModal({
    open,
    onClose,
    classId,
    eventId,
    date,
    dateLabel,
    onCancelled
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

    const isOther = reason === 'other';
    const canSubmit = reason && (!isOther || note.trim().length > 0);

    const handleReasonChange = (value: string) => {
        setReason(value);
        if (value !== 'other') {
            setNote('');
        }
    };

    const handleCancel = async () => {
        setIsSubmitting(true);
        const reasonValue = isOther ? note.trim() : reason;
        const resp = await API.patch(
            `program-classes/${classId}/events/${eventId}`,
            {
                date,
                is_cancelled: true,
                reason: reasonValue
            }
        );
        if (resp.success) {
            toast.success('Session cancelled successfully');
            onClose();
            onCancelled();
        } else {
            toast.error(resp.message || 'Failed to cancel session');
        }
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
                            onValueChange={handleReasonChange}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {CANCEL_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {isOther && (
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
                </div>
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
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
