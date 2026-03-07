import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';

interface BulkGraduateModalProps {
    open: boolean;
    onClose: () => void;
    count: number;
    onConfirm: () => Promise<void>;
}

export function BulkGraduateModal({
    open,
    onClose,
    count,
    onConfirm
}: BulkGraduateModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        await onConfirm();
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Graduate Residents
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to graduate {count}{' '}
                        {count === 1 ? 'resident' : 'residents'}?
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-2">
                    <p className="text-sm text-green-800">
                        This will update the enrollment status to
                        &quot;Completed&quot; for all selected residents.
                    </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleConfirm();
                        }}
                        disabled={isSubmitting}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        <CheckCircle className="size-4 mr-2" />
                        {isSubmitting
                            ? 'Graduating...'
                            : `Graduate ${count} ${count === 1 ? 'Resident' : 'Residents'}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
