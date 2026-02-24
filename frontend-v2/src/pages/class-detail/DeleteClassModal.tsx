import { useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
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
import API from '@/api/api';
import { toast } from 'sonner';

interface DeleteClassModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    programId: number;
    className: string;
    onDeleted: () => void;
}

export function DeleteClassModal({
    open,
    onClose,
    classId,
    programId,
    className,
    onDeleted
}: DeleteClassModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = () => {
        setConfirmText('');
        onClose();
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        const resp = await API.patch<
            unknown,
            { archived_at: string }
        >(`programs/${programId}/classes/${classId}`, {
            archived_at: new Date().toISOString()
        });
        if (resp.success) {
            toast.success(`Class "${className}" has been deleted`);
            handleClose();
            onDeleted();
        } else {
            toast.error(resp.message || 'Failed to delete class');
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Delete Class
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete{' '}
                        <strong>{className}</strong>? This action cannot be
                        undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                    <div className="flex gap-3">
                        <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-900 font-medium mb-1">
                                Warning
                            </p>
                            <p className="text-sm text-red-700">
                                This will permanently delete the class and all
                                associated session data from the system. This
                                operation is irreversible.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="deleteClassConfirmation">
                            To confirm, type the class name:{' '}
                            <strong>{className}</strong>
                        </Label>
                        <Input
                            id="deleteClassConfirmation"
                            placeholder="Type class name to confirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="border-gray-300"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            void handleDelete();
                        }}
                        disabled={confirmText !== className || isSubmitting}
                    >
                        <Trash2 className="size-4 mr-2" />
                        {isSubmitting ? 'Deleting...' : 'Delete Class'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
