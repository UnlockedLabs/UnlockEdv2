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
import { EnrollmentStatus } from '@/types/attendance';

interface ChangeEnrollmentStatusModalProps {
    open: boolean;
    onClose: () => void;
    residentDisplayId: string;
    residentName: string;
    currentStatus: EnrollmentStatus;
    allowedStatuses: EnrollmentStatus[];
    onStatusChange: (newStatus: EnrollmentStatus, reason: string) => void;
}

const STATUSES_IN_ORDER: EnrollmentStatus[] = [
    EnrollmentStatus.Enrolled,
    EnrollmentStatus.Completed,
    EnrollmentStatus.Withdrawn,
    EnrollmentStatus.Dropped,
    EnrollmentStatus.Segregated,
    EnrollmentStatus['Failed To Complete']
];

export function ChangeEnrollmentStatusModal({
    open,
    onClose,
    residentDisplayId,
    residentName,
    currentStatus,
    allowedStatuses,
    onStatusChange
}: ChangeEnrollmentStatusModalProps) {
    const [newStatus, setNewStatus] = useState<EnrollmentStatus>(currentStatus);
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) {
            setNewStatus(currentStatus);
            setReason('');
        }
    }, [open, currentStatus]);

    const needsReason =
        newStatus !== EnrollmentStatus.Enrolled &&
        newStatus !== EnrollmentStatus.Completed;
    const canSubmit =
        newStatus !== currentStatus && (!needsReason || reason.trim().length > 0);

    const handleSubmit = () => {
        onStatusChange(newStatus, reason);
        onClose();
    };

    const displayStatuses = STATUSES_IN_ORDER.filter(
        (s) => s === currentStatus || allowedStatuses.includes(s)
    );

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Change Enrollment Status</DialogTitle>
                    <DialogDescription>
                        Update enrollment status for {residentDisplayId} -{' '}
                        {residentName}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="status">New Status</Label>
                        <Select
                            value={newStatus}
                            onValueChange={(value) =>
                                setNewStatus(value as EnrollmentStatus)
                            }
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {displayStatuses.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {needsReason && (
                        <div>
                            <Label htmlFor="reason">
                                Reason for Incompletion *
                            </Label>
                            <Textarea
                                id="reason"
                                placeholder="Explain why this resident did not complete the class..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={4}
                                className="mt-1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This information will be saved in the enrollment
                                history
                            </p>
                        </div>
                    )}
                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="bg-[#556830] hover:bg-[#203622]"
                        >
                            Update Status
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
