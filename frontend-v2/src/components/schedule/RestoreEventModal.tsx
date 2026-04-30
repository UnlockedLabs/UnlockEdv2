import { useState } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { FacilityProgramClassEvent } from '@/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface RestoreEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    onSuccess: () => void;
}

export function RestoreEventModal({
    open,
    onOpenChange,
    event,
    onSuccess
}: RestoreEventModalProps) {
    const [submitting, setSubmitting] = useState(false);

    const dateStr = event.start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const timeStr = event.start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const isSeries = !event.is_override;

    async function handleConfirm() {
        setSubmitting(true);
        const d = event.start;
        const restoreDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const resp = isSeries
            ? await API.post(`program-classes/${event.class_id}/events/${event.id}/uncancel-series`, { restore_date: restoreDate })
            : await API.delete(`program-classes/${event.class_id}/events/${event.override_id}`);
        setSubmitting(false);
        if (resp.success) {
            toast.success(isSeries ? 'Future sessions restored' : 'Cancellation undone');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(resp.message || 'Failed to restore event');
        }
    }

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            title={isSeries ? 'Restore Future Sessions' : 'Restore Event'}
            description={
                isSeries
                    ? `This will restore all cancelled sessions from ${dateStr} onwards.`
                    : `This will restore the event to its original schedule: ${dateStr} at ${timeStr}`
            }
            confirmLabel={submitting ? 'Restoring...' : 'Restore'}
            onConfirm={() => void handleConfirm()}
        />
    );
}
