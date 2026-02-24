import { useState, useEffect } from 'react';
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

const STATUS_TRANSITIONS: Record<string, SelectedClassStatus[]> = {
    [SelectedClassStatus.Scheduled]: [
        SelectedClassStatus.Active,
        SelectedClassStatus.Cancelled
    ],
    [SelectedClassStatus.Active]: [
        SelectedClassStatus.Paused,
        SelectedClassStatus.Completed
    ],
    [SelectedClassStatus.Paused]: [
        SelectedClassStatus.Active,
        SelectedClassStatus.Cancelled
    ]
};

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
    const [newStatus, setNewStatus] = useState<SelectedClassStatus>(currentStatus);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const allowedStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];

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
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Class Status
                    </DialogTitle>
                    <DialogDescription>
                        Update the status for {className}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="classStatus">New Status</Label>
                        <Select
                            value={newStatus}
                            onValueChange={(v) =>
                                setNewStatus(v as SelectedClassStatus)
                            }
                        >
                            <SelectTrigger id="classStatus" className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={currentStatus}>
                                    {currentStatus} (current)
                                </SelectItem>
                                {allowedStatuses.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            onClick={() => {
                                void handleSubmit();
                            }}
                            disabled={
                                newStatus === currentStatus || isSubmitting
                            }
                            className="bg-[#556830] hover:bg-[#203622]"
                        >
                            {isSubmitting ? 'Updating...' : 'Update Status'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
