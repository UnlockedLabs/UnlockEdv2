import { useCallback, useState } from 'react';
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

interface DeactivateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    onSuccess: () => void;
}

export function DeactivateDialog({
    open,
    onOpenChange,
    user,
    onSuccess
}: DeactivateDialogProps) {
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

    const handleDeactivate = async () => {
        setSubmitting(true);
        const resp = await API.post(`users/${user.id}/deactivate`, {});
        setSubmitting(false);
        if (resp.success) {
            toast.success(
                `${user.name_first} ${user.name_last} has been deactivated`
            );
            onSuccess();
            handleClose(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deactivate Account</DialogTitle>
                    <DialogDescription>
                        You are about to deactivate {user.name_first}{' '}
                        {user.name_last}'s account.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                The resident will be withdrawn from all active
                                classes and programs.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                The resident's account will be locked and marked
                                as Deactivated.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                Staff will no longer be able to edit this
                                resident's account.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                The resident will not be able to log in or
                                enroll in new programs.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                The time this account was deactivated will be
                                recorded.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">-</span>
                            <span>
                                The resident's account history and favorites
                                will be preserved and remain searchable.
                            </span>
                        </li>
                    </ul>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <Label htmlFor="deactivate-confirm">
                            To confirm, type the Resident ID:{' '}
                            <strong>{docId}</strong>
                        </Label>
                        <Input
                            id="deactivate-confirm"
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
                        onClick={() => void handleDeactivate()}
                        disabled={confirmInput !== docId || submitting}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        Deactivate Account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
