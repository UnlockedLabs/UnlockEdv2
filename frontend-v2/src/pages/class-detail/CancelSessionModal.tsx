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
import { CancelEventReason } from '@/types/program';
import API from '@/api/api';
import { toast } from 'sonner';

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

    const isOther = reason === String(CancelEventReason['Other (add note)']);
    const canSubmit = reason && (!isOther || note.trim().length > 0);

    const handleCancel = async () => {
        setIsSubmitting(true);
        const resp = await API.patch(
            `program-classes/${classId}/events/${eventId}`,
            {
                date,
                is_cancelled: true,
                reason: isOther ? note.trim() : reason
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
                        Cancel Session
                    </DialogTitle>
                    <DialogDescription>
                        Cancel the session scheduled for {dateLabel}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="cancelReason">
                            Cancellation Reason
                        </Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger
                                id="cancelReason"
                                className="mt-1"
                            >
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(CancelEventReason).map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {isOther && (
                        <div>
                            <Label htmlFor="cancelNote">Note *</Label>
                            <Textarea
                                id="cancelNote"
                                placeholder="Provide details for the cancellation..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                                className="mt-1"
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
                        Keep Session
                    </Button>
                    <Button
                        onClick={() => {
                            void handleCancel();
                        }}
                        disabled={!canSubmit || isSubmitting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isSubmitting ? 'Cancelling...' : 'Cancel Session'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
