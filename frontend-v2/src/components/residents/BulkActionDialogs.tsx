import { useState, useEffect } from 'react';
import API from '@/api/api';
import {
    User,
    BulkPasswordResult,
    ServerResponseOne,
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
import { AlertCircle, CheckCircle, Download } from 'lucide-react';

interface BulkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residents: User[];
    onSuccess: () => void;
}

function formatNameLastFirst(r: User) {
    return `${r.name_last}, ${r.name_first}`;
}

export function BulkResetPasswordDialog({
    open,
    onOpenChange,
    residents,
    onSuccess
}: BulkDialogProps) {
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BulkPasswordResult[]>([]);

    useEffect(() => {
        if (!open) {
            setConfirmInput('');
            setResults([]);
        }
    }, [open]);

    const handleGenerate = async () => {
        setLoading(true);
        const response = (await API.post<BulkPasswordResult[], object>(
            'users/bulk/reset-password',
            { user_ids: residents.map((r) => r.id) }
        )) as ServerResponseOne<BulkPasswordResult[]>;
        setLoading(false);

        if (response.success) {
            setResults(response.data);
        }
    };

    const handleDownload = () => {
        if (results.length === 0) return;
        const header = 'Resident ID,Name,Username,Temporary Password';
        const rows = results.map(
            (r) => `${r.doc_id},${r.name},${r.username},${r.temp_password}`
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk-passwords-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClose = (value: boolean) => {
        if (!value && results.length > 0) {
            onSuccess();
        }
        onOpenChange(value);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk Reset Passwords</DialogTitle>
                    <DialogDescription>
                        Generate new temporary passwords for{' '}
                        {residents.length} selected resident
                        {residents.length > 1 ? 's' : ''}
                    </DialogDescription>
                </DialogHeader>

                {results.length === 0 ? (
                    <>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="font-medium text-sm text-blue-900 mb-1">
                                        Selected Residents
                                    </div>
                                    <p className="text-sm text-blue-800 mb-2">
                                        New temporary passwords will be
                                        generated for:
                                    </p>
                                    <div className="bg-white border border-blue-200 rounded p-3 max-h-48 overflow-y-auto">
                                        <ul className="text-sm text-gray-700 space-y-1">
                                            {residents.map((r) => (
                                                <li key={r.id}>
                                                    {'\u2022'}{' '}
                                                    {formatNameLastFirst(r)} (
                                                    {r.doc_id ?? ''})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bulk-reset-confirm">
                                Type{' '}
                                <span className="font-mono font-semibold">
                                    {residents.length}
                                </span>{' '}
                                to confirm
                            </Label>
                            <Input
                                id="bulk-reset-confirm"
                                value={confirmInput}
                                onChange={(e) =>
                                    setConfirmInput(e.target.value)
                                }
                                placeholder={`Type ${residents.length}`}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleGenerate()}
                                disabled={
                                    confirmInput !==
                                        String(residents.length) || loading
                                }
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                Generate Passwords
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="size-5 text-green-600" />
                                <div>
                                    <div className="font-medium text-sm text-green-900">
                                        Passwords Generated!
                                    </div>
                                    <p className="text-sm text-green-700 mt-1">
                                        {results.length} temporary passwords
                                        have been created. Download the CSV
                                        file to distribute to residents.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                onClick={handleDownload}
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                <Download className="size-4 mr-2" />
                                Download Password File
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function BulkDeactivateDialog({
    open,
    onOpenChange,
    residents,
    onSuccess
}: BulkDialogProps) {
    const { toaster } = useToast();
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) setConfirmInput('');
    }, [open]);

    const handleDeactivate = async () => {
        setLoading(true);
        const response = (await API.post<
            { success_count: number; failed_count: number },
            object
        >('users/bulk/deactivate', {
            user_ids: residents.map((r) => r.id)
        })) as ServerResponseOne<{
            success_count: number;
            failed_count: number;
        }>;
        setLoading(false);

        if (response.success) {
            const { success_count, failed_count } = response.data;
            const msg =
                failed_count > 0
                    ? `${success_count} resident${success_count > 1 ? 's' : ''} deactivated, ${failed_count} failed`
                    : `${success_count} resident${success_count > 1 ? 's' : ''} deactivated`;
            toaster(
                msg,
                failed_count > 0 ? ToastState.error : ToastState.success
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to deactivate residents',
                ToastState.error
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deactivate Residents</DialogTitle>
                    <DialogDescription>
                        Deactivate {residents.length} selected resident
                        {residents.length > 1 ? 's' : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="font-medium text-sm text-orange-900 mb-1">
                                This will deactivate these accounts
                            </div>
                            <div className="bg-white border border-orange-200 rounded p-3 max-h-48 overflow-y-auto mt-2">
                                <ul className="text-sm text-gray-700 space-y-1">
                                    {residents.map((r) => (
                                        <li key={r.id}>
                                            {'\u2022'}{' '}
                                            {formatNameLastFirst(r)} (
                                            {r.doc_id ?? ''})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="bulk-deactivate-confirm">
                        Type{' '}
                        <span className="font-mono font-semibold">
                            {residents.length}
                        </span>{' '}
                        to confirm
                    </Label>
                    <Input
                        id="bulk-deactivate-confirm"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder={`Type ${residents.length}`}
                    />
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
                        disabled={
                            confirmInput !== String(residents.length) ||
                            loading
                        }
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        Deactivate {residents.length} Accounts
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function BulkDeleteDialog({
    open,
    onOpenChange,
    residents,
    onSuccess
}: BulkDialogProps) {
    const { toaster } = useToast();
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) setConfirmInput('');
    }, [open]);

    const handleDelete = async () => {
        setLoading(true);
        const response = (await API.post<
            { success_count: number; failed_count: number },
            object
        >('users/bulk/delete', {
            user_ids: residents.map((r) => r.id)
        })) as ServerResponseOne<{
            success_count: number;
            failed_count: number;
        }>;
        setLoading(false);

        if (response.success) {
            const { success_count, failed_count } = response.data;
            const msg =
                failed_count > 0
                    ? `${success_count} resident${success_count > 1 ? 's' : ''} deleted, ${failed_count} failed`
                    : `${success_count} resident${success_count > 1 ? 's' : ''} deleted`;
            toaster(
                msg,
                failed_count > 0 ? ToastState.error : ToastState.success
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to delete residents',
                ToastState.error
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Residents</DialogTitle>
                    <DialogDescription>
                        Permanently delete {residents.length} selected
                        resident{residents.length > 1 ? 's' : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="font-medium text-sm text-red-900 mb-1">
                                This action cannot be undone
                            </div>
                            <p className="text-sm text-red-800 mb-2">
                                These resident accounts and all associated
                                data will be permanently deleted:
                            </p>
                            <div className="bg-white border border-red-200 rounded p-3 max-h-48 overflow-y-auto">
                                <ul className="text-sm text-gray-700 space-y-1">
                                    {residents.map((r) => (
                                        <li key={r.id}>
                                            {'\u2022'}{' '}
                                            {formatNameLastFirst(r)} (
                                            {r.doc_id ?? ''})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="bulk-delete-confirm">
                        Type{' '}
                        <span className="font-mono font-semibold">
                            {residents.length}
                        </span>{' '}
                        to confirm deletion
                    </Label>
                    <Input
                        id="bulk-delete-confirm"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder={`Type ${residents.length}`}
                    />
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
                        disabled={
                            confirmInput !== String(residents.length) ||
                            loading
                        }
                        className="bg-red-600 hover:bg-red-700"
                    >
                        Delete {residents.length} Residents
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
