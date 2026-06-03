import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FormModal } from '@/components/shared';
import { SelectedClassStatus } from '@/types/attendance';
import API from '@/api/api';
import { toast } from 'sonner';

interface ChangeClassStatusModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    programId: number;
    className: string;
    currentStatus: SelectedClassStatus;
    capacity: number;
    onStatusChanged: () => void;
}

const ALL_STATUSES: SelectedClassStatus[] = [
    SelectedClassStatus.Active,
    SelectedClassStatus.Scheduled,
    SelectedClassStatus.Completed,
    SelectedClassStatus.Cancelled
];

function getStatusDescription(status: SelectedClassStatus): string {
    switch (status) {
        case SelectedClassStatus.Active:
            return 'Class is currently running and accepting attendance.';
        case SelectedClassStatus.Scheduled:
            return 'Class is scheduled to begin in the future.';
        case SelectedClassStatus.Completed:
            return 'Class has finished and is now archived.';
        case SelectedClassStatus.Cancelled:
            return 'Class has been cancelled and will not take place.';
        default:
            return '';
    }
}

export function ChangeClassStatusModal({
    open,
    onClose,
    classId,
    programId,
    className,
    currentStatus,
    capacity,
    onStatusChanged
}: ChangeClassStatusModalProps) {
    const [newStatus, setNewStatus] =
        useState<SelectedClassStatus>(currentStatus);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setNewStatus(currentStatus);
        }
    }, [open, currentStatus]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const resp = await API.patch<
            unknown,
            { status: string; capacity: number }
        >(`programs/${programId}/classes/${classId}`, {
            status: newStatus,
            capacity
        });
        if (resp.success) {
            toast.success(`Class status updated to ${newStatus}`);
            onClose();
            onStatusChanged();
        } else {
            toast.error(resp.message || 'Failed to update status');
        }
        setIsSubmitting(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Change Class Status"
            description={`Update the status for ${className}`}
            className="max-w-md"
            titleClassName="text-foreground"
        >
            <div className="space-y-4">
                <div>
                    <Label htmlFor="classStatus">New Status</Label>
                    <Select
                        value={newStatus}
                        onValueChange={(v) =>
                            setNewStatus(v as SelectedClassStatus)
                        }
                    >
                        <SelectTrigger id="classStatus">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-2">
                        {getStatusDescription(newStatus)}
                    </p>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={isSubmitting}
                        variant="brand"
                    >
                        {isSubmitting ? 'Updating...' : 'Update Status'}
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
