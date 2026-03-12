import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';

interface SelectedResident {
    id: number;
    displayId: string;
    name: string;
}

interface BulkGraduateModalProps {
    open: boolean;
    onClose: () => void;
    selectedResidents: SelectedResident[];
    onConfirm: () => Promise<void>;
}

export function BulkGraduateModal({
    open,
    onClose,
    selectedResidents,
    onConfirm
}: BulkGraduateModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const count = selectedResidents.length;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        await onConfirm();
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Graduate {count}{' '}
                        {count === 1 ? 'Resident' : 'Residents'}
                    </DialogTitle>
                    <DialogDescription>
                        Mark selected residents as completed. This will update
                        their enrollment status to &quot;Completed&quot;.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>
                            Selected Residents ({count})
                        </Label>
                        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                            <div className="divide-y divide-gray-200">
                                {selectedResidents.map((resident) => (
                                    <div
                                        key={resident.id}
                                        className="px-3 py-2 text-sm"
                                    >
                                        <span className="font-medium text-[#203622]">
                                            {resident.displayId}
                                        </span>
                                        <span className="text-gray-600 ml-2">
                                            {resident.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                void handleConfirm();
                            }}
                            disabled={isSubmitting}
                            className="bg-[#556830] hover:bg-[#203622]"
                        >
                            {isSubmitting
                                ? 'Graduating...'
                                : `Graduate ${count} ${count === 1 ? 'Resident' : 'Residents'}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
