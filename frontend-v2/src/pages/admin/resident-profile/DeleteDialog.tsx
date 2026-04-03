import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import API from '@/api/api';
import { User } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
}

export function DeleteDialog({
    open,
    onOpenChange,
    user
}: DeleteDialogProps) {
    const navigate = useNavigate();
    const [confirmInput, setConfirmInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const docId = user.doc_id ?? '';

    const handleClose = useCallback(
        (isOpen: boolean) => {
            if (!isOpen) setConfirmInput('');
            onOpenChange(isOpen);
        },
        [onOpenChange]
    );

    const handleDelete = async () => {
        setSubmitting(true);
        const resp = await API.delete(`users/${user.id}`);
        setSubmitting(false);
        if (resp.success) {
            toast.success(
                `${user.name_first} ${user.name_last} has been deleted`
            );
            handleClose(false);
            navigate('/residents');
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Resident</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete {user.name_first}{' '}
                        {user.name_last}?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-red-600 font-medium">
                        This action cannot be undone. All data associated with
                        this resident will be permanently deleted.
                    </p>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <Label htmlFor="delete-confirm">
                            To confirm, type the Resident ID:{' '}
                            <strong>{docId}</strong>
                        </Label>
                        <Input
                            id="delete-confirm"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder="Type Resident ID to confirm"
                            className="mt-2"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleDelete()}
                        disabled={confirmInput !== docId || submitting}
                        variant="destructive"
                    >
                        Delete Resident
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
