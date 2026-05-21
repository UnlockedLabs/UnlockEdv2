import { useState } from 'react';
import { AlertCircle, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormModal, TonedPanel } from '@/components/shared';
import { useTypeToConfirm } from '@/components/shared/useTypeToConfirm';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const confirm = useTypeToConfirm({ open, expected: residentDisplayId });

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
            onClose();
            onUnenrolled();
        } else {
            toast.error(resp.message || 'Failed to unenroll resident');
        }
        setIsSubmitting(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Unenroll Resident"
            description="Are you sure you want to unenroll this resident from the class?"
            titleClassName="text-foreground"
        >
            <div className="space-y-4 py-4">
                <TonedPanel tone="amber">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-medium mb-1">
                                This action will completely remove the enrollment
                            </p>
                            <p>
                                This should only be used to correct accidental
                                enrollments. For residents who are leaving the
                                program normally, use the &quot;Change
                                Status&quot; option instead (Dropped, Graduated,
                                etc.).
                            </p>
                        </div>
                    </div>
                </TonedPanel>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Resident ID:</span>
                        <span className="font-medium text-brand-dark">
                            {residentDisplayId}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium text-brand-dark">
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
                        {...confirm.inputProps}
                        className="mt-2"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    onClick={() => void handleUnenroll()}
                    disabled={!confirm.matches || isSubmitting}
                >
                    <UserMinus className="size-4 mr-2" />
                    {isSubmitting ? 'Unenrolling...' : 'Unenroll Resident'}
                </Button>
            </div>
        </FormModal>
    );
}
