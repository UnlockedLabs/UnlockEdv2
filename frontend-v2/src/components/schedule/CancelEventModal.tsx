import { useState } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { FacilityProgramClassEvent, CancelEventReason } from '@/types';
import { FormModal } from '@/components/shared/FormModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

interface CancelEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    onSuccess: () => void;
}

function buildSingleInstanceRRule(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `DTSTART;TZID=Local:${y}${m}${d}T${h}${min}00\nRRULE:FREQ=DAILY;COUNT=1`;
}

export function CancelEventModal({
    open,
    onOpenChange,
    event,
    onSuccess
}: CancelEventModalProps) {
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isOther = reason === CancelEventReason['Other (add note)'];
    const finalReason = isOther ? customReason.trim() : reason;

    async function handleSubmit() {
        if (!finalReason) {
            toast.error('Please select a reason');
            return;
        }
        setSubmitting(true);
        const resp = await API.put(
            `program-classes/${event.class_id}/events/${event.id}`,
            [
                {
                    event_id: event.id,
                    is_cancelled: true,
                    override_rrule: buildSingleInstanceRRule(event.start),
                    duration: event.duration,
                    reason: finalReason
                }
            ]
        );
        setSubmitting(false);
        if (resp.success) {
            toast.success('Event cancelled');
            setReason('');
            setCustomReason('');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(resp.message || 'Failed to cancel event');
        }
    }

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Cancel Event"
            description={`Cancel "${event.title}" on ${event.start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger>
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
                    <div className="space-y-2">
                        <Label>Details</Label>
                        <Textarea
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Describe the reason..."
                            rows={3}
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Keep Event
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={submitting || !finalReason}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {submitting ? 'Cancelling...' : 'Cancel Event'}
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
