import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import API from '@/api/api';
import {
    User,
    Facility,
    ValidResident,
    ServerResponseOne,
    ResetPasswordResponse,
    ToastState
} from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Copy, Check } from 'lucide-react';

interface EditFormData {
    name_first: string;
    name_last: string;
    doc_id: string;
}

interface EditResidentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resident: User;
    onSuccess: () => void;
}

export function EditResidentDialog({
    open,
    onOpenChange,
    resident,
    onSuccess
}: EditResidentDialogProps) {
    const { toaster } = useToast();
    const form = useForm<EditFormData>();

    useEffect(() => {
        if (open) {
            form.reset({
                name_first: resident.name_first,
                name_last: resident.name_last,
                doc_id: resident.doc_id ?? ''
            });
        }
    }, [open, resident, form]);

    const handleSave = async (data: EditFormData) => {
        const response = await API.patch<User, object>(
            `users/${resident.id}`,
            data
        );
        if (response.success) {
            toaster('Resident updated successfully', ToastState.success);
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to update resident',
                ToastState.error
            );
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
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(
                            (d) => void handleSave(d)
                        )(e);
                    }}
                    className="space-y-4 py-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="edit-first">First Name</Label>
                            <Input
                                id="edit-first"
                                {...form.register('name_first', {
                                    required: true
                                })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-last">Last Name</Label>
                            <Input
                                id="edit-last"
                                {...form.register('name_last', {
                                    required: true
                                })}
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="edit-username">Username</Label>
                        <Input
                            id="edit-username"
                            value={resident.username}
                            disabled
                            className="mt-2 bg-muted"
                        />
                    </div>
                    <div>
                        <Label htmlFor="edit-doc-id">Resident ID</Label>
                        <Input
                            id="edit-doc-id"
                            {...form.register('doc_id')}
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#556830] hover:bg-[#203622]"
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ResetPasswordConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resident: User;
    onSuccess: (tempPassword: string) => void;
}

export function ResetPasswordConfirmDialog({
    open,
    onOpenChange,
    resident,
    onSuccess
}: ResetPasswordConfirmDialogProps) {
    const { toaster } = useToast();
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        const response = (await API.post<ResetPasswordResponse, object>(
            `users/${resident.id}/student-password`,
            {}
        )) as ServerResponseOne<ResetPasswordResponse>;
        setLoading(false);

        if (response.success) {
            toaster('Password reset successfully', ToastState.success);
            onOpenChange(false);
            onSuccess(response.data.temp_password);
        } else {
            toaster('Failed to reset password', ToastState.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to reset {resident.name_first}{' '}
                        {resident.name_last}&apos;s password?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-gray-600">
                        This will generate a temporary password for the
                        resident. They will be required to change it on their
                        next login.
                    </p>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleConfirm()}
                        disabled={loading}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Reset Password
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ResetPasswordResultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residentName: string;
    tempPassword: string;
}

export function ResetPasswordResultDialog({
    open,
    onOpenChange,
    residentName,
    tempPassword
}: ResetPasswordResultDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        void navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Password Reset</DialogTitle>
                    <DialogDescription>
                        New temporary password for {residentName}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                        <div className="text-sm text-gray-600 mb-2">
                            Temporary Password
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-lg font-mono font-semibold text-[#203622]">
                                {tempPassword}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <>
                                        <Check className="size-4 mr-2" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="size-4 mr-2" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                        Share this password securely with the resident. They
                        will be prompted to change it on their next login.
                    </p>
                </div>
                <DialogFooter>
                    <Button
                        onClick={() => onOpenChange(false)}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface DeactivateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resident: User;
    onSuccess: () => void;
}

export function DeactivateDialog({
    open,
    onOpenChange,
    resident,
    onSuccess
}: DeactivateDialogProps) {
    const { toaster } = useToast();
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) setConfirmInput('');
    }, [open]);

    const handleDeactivate = async () => {
        setLoading(true);
        const response = await API.post<string, object>(
            `users/${resident.id}/deactivate`,
            {}
        );
        setLoading(false);

        if (response.success) {
            toaster(
                `${resident.name_first} ${resident.name_last} has been deactivated`,
                ToastState.success
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to deactivate resident',
                ToastState.error
            );
        }
    };

    const displayId = resident.doc_id ?? '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deactivate Account</DialogTitle>
                    <DialogDescription>
                        You are about to deactivate {resident.name_first}{' '}
                        {resident.name_last}&apos;s account.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                The resident will be withdrawn from all active
                                classes and programs.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                The resident&apos;s account will be locked and
                                marked as Deactivated.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                Staff will no longer be able to edit this
                                resident&apos;s account.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                The resident will not be able to log in or
                                enroll in new programs.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                The time this account was deactivated will be
                                recorded.
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-400">&bull;</span>
                            <span>
                                The resident&apos;s account history and
                                favorites will be preserved and remain
                                searchable.
                            </span>
                        </li>
                    </ul>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <Label htmlFor="deactivate-confirm">
                            To confirm, type the Resident ID:{' '}
                            <strong>{displayId}</strong>
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
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleDeactivate()}
                        disabled={confirmInput !== displayId || loading}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        Deactivate Account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface DeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resident: User;
    onSuccess: () => void;
}

export function DeleteDialog({
    open,
    onOpenChange,
    resident,
    onSuccess
}: DeleteDialogProps) {
    const { toaster } = useToast();
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) setConfirmInput('');
    }, [open]);

    const handleDelete = async () => {
        setLoading(true);
        const response = await API.delete(`users/${resident.id}`);
        setLoading(false);

        if (response.success) {
            toaster(
                `${resident.name_first} ${resident.name_last} has been deleted`,
                ToastState.success
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to delete resident',
                ToastState.error
            );
        }
    };

    const displayId = resident.doc_id ?? '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Resident</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete {resident.name_first}{' '}
                        {resident.name_last}?
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
                            <strong>{displayId}</strong>
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
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleDelete()}
                        disabled={confirmInput !== displayId || loading}
                        variant="destructive"
                    >
                        Delete Resident
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resident: User;
    facilities: Facility[];
    onSuccess: () => void;
}

export function TransferDialog({
    open,
    onOpenChange,
    resident,
    facilities,
    onSuccess
}: TransferDialogProps) {
    const { toaster } = useToast();
    const [transferFacilityId, setTransferFacilityId] = useState('');
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setTransferFacilityId('');
            setConfirmInput('');
        }
    }, [open]);

    const { data: verifyResp } = useSWR<ServerResponseOne<ValidResident>>(
        open && transferFacilityId
            ? `/api/users/resident-verify?user_id=${resident.id}&facility_id=${transferFacilityId}&doc_id=${encodeURIComponent(resident.doc_id ?? '')}`
            : null
    );
    const rawConflicts = verifyResp?.data?.program_names ?? [];
    const programConflicts = [
        ...new Set(rawConflicts.map((c) => c.program_name))
    ];

    const handleTransfer = async () => {
        setLoading(true);
        const response = await API.patch<string, object>(
            'users/resident-transfer',
            {
                user_id: resident.id,
                curr_facility_id:
                    resident.facility?.id ?? resident.facility_id,
                trans_facility_id: Number(transferFacilityId)
            }
        );
        setLoading(false);

        if (response.success) {
            toaster(
                `${resident.name_first} ${resident.name_last} transferred successfully`,
                ToastState.success
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to transfer resident',
                ToastState.error
            );
        }
    };

    const displayId = resident.doc_id ?? '';
    const currentFacilityName =
        resident.facility?.name ??
        facilities.find((f) => f.id === resident.facility_id)?.name ??
        'Unknown';
    const targetFacilityName =
        facilities.find((f) => String(f.id) === transferFacilityId)?.name ?? '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Transfer Resident</DialogTitle>
                    <DialogDescription>
                        Move {resident.name_last}, {resident.name_first} to a
                        different facility
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                            Current Facility:{' '}
                            <span className="font-medium text-gray-900">
                                {currentFacilityName}
                            </span>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">
                                New Facility
                            </Label>
                            <Select
                                value={transferFacilityId}
                                onValueChange={setTransferFacilityId}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select facility" />
                                </SelectTrigger>
                                <SelectContent>
                                    {facilities
                                        .filter(
                                            (f) =>
                                                f.id !==
                                                (resident.facility?.id ??
                                                    resident.facility_id)
                                        )
                                        .map((f) => (
                                            <SelectItem
                                                key={f.id}
                                                value={String(f.id)}
                                            >
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {transferFacilityId && (
                        <>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div className="font-medium text-orange-900 text-sm mb-1">
                                    Transfer will unenroll resident from all
                                    classes
                                </div>
                                <div className="text-sm text-orange-800">
                                    {resident.name_first} will be removed from
                                    all active enrollments and must be
                                    re-enrolled at the new facility.
                                </div>
                            </div>

                            {programConflicts.length > 0 && (
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="font-medium text-sm text-gray-900 mb-3">
                                        Programs not available at{' '}
                                        {targetFacilityName}
                                    </div>
                                    <div className="space-y-2">
                                        {programConflicts.map(
                                            (name, idx) => (
                                                <div
                                                    key={idx}
                                                    className="text-sm text-gray-600 flex items-center gap-2"
                                                >
                                                    <div className="size-1.5 rounded-full bg-gray-400" />
                                                    {name}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    What happens next
                                </div>
                                <div className="space-y-1.5 text-sm text-gray-700">
                                    <div className="flex items-center gap-2">
                                        <Check className="size-4 text-green-600 shrink-0" />
                                        <span>
                                            Account history and favorites will
                                            be preserved
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Check className="size-4 text-green-600 shrink-0" />
                                        <span>
                                            Resident can log in at{' '}
                                            {targetFacilityName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <Label
                                    htmlFor="transfer-confirm"
                                    className="text-sm font-medium"
                                >
                                    Type{' '}
                                    <span className="font-mono font-semibold text-[#203622]">
                                        {displayId}
                                    </span>{' '}
                                    to confirm
                                </Label>
                                <Input
                                    id="transfer-confirm"
                                    value={confirmInput}
                                    onChange={(e) =>
                                        setConfirmInput(e.target.value)
                                    }
                                    placeholder="Enter Resident ID"
                                    className="mt-2"
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleTransfer()}
                        disabled={
                            !transferFacilityId ||
                            confirmInput !== displayId ||
                            loading
                        }
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Transfer Resident
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
