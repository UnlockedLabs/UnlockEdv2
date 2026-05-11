import { useState } from 'react';
import { AlertCircle, UserMinus } from 'lucide-react';
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
import { EnrollmentStatus } from '@/types/attendance';
import API from '@/api/api';
import { toast } from 'sonner';

interface UnenrollResidentModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    userId: number;
    residentDisplayId: string;
    residentName: string;
    onUnenrolled: () => void;
}

export function UnenrollResidentModal({
    open,
    onClose,
    classId,
    userId,
    residentDisplayId,
    residentName,
    onUnenrolled
}: UnenrollResidentModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = () => {
        setConfirmText('');
        onClose();
    };

    const handleUnenroll = async () => {
        setIsSubmitting(true);
        const resp = await API.patch<
            unknown,
            { enrollment_status: string; user_ids: number[] }
        >(`program-classes/${classId}/enrollments`, {
            enrollment_status: EnrollmentStatus.Cancelled,
            user_ids: [userId]
        });
        if (resp.success) {
            toast.success(
                `${residentName} (${residentDisplayId}) has been unenrolled from the class`
            );
            handleClose();
            onUnenrolled();
        } else {
            toast.error(resp.message || 'Failed to unenroll resident');
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unenroll Resident</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to unenroll this resident from the
                        class?
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-900">
                                <p className="font-medium mb-1">
                                    This action will completely remove the
                                    enrollment
                                </p>
                                <p>
                                    This should only be used to correct
                                    accidental enrollments. For residents who are
                                    leaving the program normally, use the
                                    &quot;Change Status&quot; option instead
                                    (Dropped, Graduated, etc.).
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Resident ID:</span>
                            <span className="font-medium text-[#203622]">
                                {residentDisplayId}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Name:</span>
                            <span className="font-medium text-[#203622]">
                                {residentName}
                            </span>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="unenrollConfirmation">
                            To confirm, type the resident ID:{' '}
                            <strong>{residentDisplayId}</strong>
                        </Label>
                        <Input
                            id="unenrollConfirmation"
                            placeholder="Type resident ID to confirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            void handleUnenroll();
                        }}
                        disabled={
                            confirmText !== residentDisplayId || isSubmitting
                        }
                    >
                        <UserMinus className="size-4 mr-2" />
                        {isSubmitting ? 'Unenrolling...' : 'Unenroll Resident'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
