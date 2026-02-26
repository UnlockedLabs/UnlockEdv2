import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import API from '@/api/api';
import { toast } from 'sonner';

interface RescheduleSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    eventId: number;
    dateLabel: string;
    onRescheduled: () => void;
}

export function RescheduleSessionModal({
    open,
    onClose,
    classId,
    eventId,
    dateLabel,
    onRescheduled
}: RescheduleSessionModalProps) {
    const [newDate, setNewDate] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setNewDate('');
            setNewStartTime('');
        }
    }, [open]);

    const handleReschedule = async () => {
        setIsSubmitting(true);
        const body: { date: string; start_time?: string } = { date: newDate };
        if (newStartTime) {
            body.start_time = newStartTime;
        }
        const resp = await API.patch<unknown, typeof body>(
            `program-classes/${classId}/events/${eventId}`,
            body
        );
        if (resp.success) {
            toast.success('Session rescheduled successfully');
            onClose();
            onRescheduled();
        } else {
            toast.error(resp.message || 'Failed to reschedule session');
        }
        setIsSubmitting(false);
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Reschedule Session
                    </DialogTitle>
                    <DialogDescription>
                        Reschedule the session from {dateLabel}. You can change
                        the date and time.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="rescheduleDate">New Date</Label>
                        <Input
                            id="rescheduleDate"
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            min={today}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="rescheduleTime">
                            New Start Time (optional)
                        </Label>
                        <Input
                            id="rescheduleTime"
                            type="time"
                            value={newStartTime}
                            onChange={(e) => setNewStartTime(e.target.value)}
                            className="mt-1"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Leave blank to keep the current time.
                        </p>
                    </div>
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
                            void handleReschedule();
                        }}
                        disabled={!newDate || isSubmitting}
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        {isSubmitting
                            ? 'Rescheduling...'
                            : 'Reschedule Session'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
