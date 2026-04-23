import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { useChangeEventField } from './useChangeEventField';

interface CancelEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    onSuccess: () => void;
    showApplyToFuture?: boolean;
}

export function CancelEventModal({
    open,
    onOpenChange,
    event,
    onSuccess,
    showApplyToFuture = true
}: CancelEventModalProps) {
    const [reason, setReason] = useState<CancelEventReason | ''>('');
    const [customReason, setCustomReason] = useState('');
    const [applyToFuture, setApplyToFuture] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isOther = reason === CancelEventReason['Other (add note)'];
    const finalReason = isOther ? customReason.trim() : reason;

    const { submitSingleSessionChange, submitCancelSeriesChange } = useChangeEventField(
        event,
        { is_cancelled: true },
        finalReason
    );

    useEffect(() => {
        if (open) {
            setReason('');
            setCustomReason('');
            setApplyToFuture(false);
        }
    }, [open]);

    async function handleSubmit() {
        if (!finalReason) {
            toast.error('Please select a reason');
            return;
        }
        setSubmitting(true);

        const result = applyToFuture
            ? await submitCancelSeriesChange()
            : await submitSingleSessionChange();

        setSubmitting(false);

        if (result.success) {
            toast.success(
                applyToFuture
                    ? `Class on ${event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and all future sessions cancelled`
                    : `Class on ${event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} cancelled`
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.message ?? 'Failed to cancel class');
        }
    }

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Cancel Class"
            description={`Cancel the class scheduled for ${event.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        >
            <div className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label>Reason for Cancellation *</Label>
                    <Select value={reason} onValueChange={(v) => setReason(v as CancelEventReason)}>
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

                {showApplyToFuture && (
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="apply-to-future"
                            checked={applyToFuture}
                            onChange={(e) => setApplyToFuture(e.target.checked)}
                            className="size-4 rounded border-gray-300"
                        />
                        <label htmlFor="apply-to-future" className="text-sm font-normal cursor-pointer">
                            Apply this change to all future sessions
                        </label>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={submitting || !finalReason}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {submitting ? 'Cancelling...' : 'Cancel Class'}
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
