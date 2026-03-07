import { useEffect, useState } from 'react';
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

interface EditProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    onSuccess: () => void;
}

export function EditProfileDialog({
    open,
    onOpenChange,
    user,
    onSuccess
}: EditProfileDialogProps) {
    const [firstName, setFirstName] = useState(user.name_first);
    const [lastName, setLastName] = useState(user.name_last);
    const [docId, setDocId] = useState(user.doc_id ?? '');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setFirstName(user.name_first);
            setLastName(user.name_last);
            setDocId(user.doc_id ?? '');
        }
    }, [open, user]);

    const handleSave = async () => {
        setSubmitting(true);
        const resp = await API.patch<User, Partial<User>>(
            `users/${user.id}`,
            { name_first: firstName, name_last: lastName, doc_id: docId }
        );
        setSubmitting(false);
        if (resp.success) {
            toast.success(
                `${firstName} ${lastName}'s profile updated`
            );
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Resident Profile</DialogTitle>
                    <DialogDescription>
                        Update resident information
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="edit-firstName">First Name</Label>
                            <Input
                                id="edit-firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-lastName">Last Name</Label>
                            <Input
                                id="edit-lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="edit-username">Username</Label>
                        <Input
                            id="edit-username"
                            value={user.username}
                            disabled
                            className="mt-2 bg-gray-50"
                        />
                    </div>
                    <div>
                        <Label htmlFor="edit-docId">Resident ID</Label>
                        <Input
                            id="edit-docId"
                            value={docId}
                            onChange={(e) => setDocId(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSave()}
                        disabled={submitting}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
