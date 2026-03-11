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
import { AlertCircle, Download } from 'lucide-react';

interface BulkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residents: User[];
    onSuccess: () => void;
}

function ResidentList({ residents }: { residents: User[] }) {
    return (
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {residents.map((r) => (
                <div
                    key={r.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                >
                    <span className="font-medium text-gray-900">
                        {r.name_last}, {r.name_first}
                    </span>
                    <span className="text-gray-500">{r.doc_id ?? ''}</span>
                </div>
            ))}
        </div>
    );
}

function CountConfirmInput({
    count,
    value,
    onChange,
    label
}: {
    count: number;
    value: string;
    onChange: (v: string) => void;
    label?: string;
}) {
    return (
        <div>
            <Label>
                {label ?? 'To confirm, type the number of residents'}:{' '}
                <strong>{count}</strong>
            </Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`Type ${count} to confirm`}
                className="mt-2"
            />
        </div>
    );
}

export function BulkResetPasswordDialog({
    open,
    onOpenChange,
    residents,
    onSuccess
}: BulkDialogProps) {
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BulkPasswordResult[] | null>(null);

    useEffect(() => {
        if (!open) {
            setConfirmInput('');
            setResults(null);
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
        if (!results) return;
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
        if (!value && results) {
            onSuccess();
        }
        onOpenChange(value);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Passwords</DialogTitle>
                    <DialogDescription>
                        {results
                            ? `Passwords generated for ${results.length} resident(s)`
                            : `Generate temporary passwords for ${residents.length} resident(s)`}
                    </DialogDescription>
                </DialogHeader>
                {results ? (
                    <div className="py-4 space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                            Temporary passwords have been generated.
                            Download the password file to share with
                            residents securely.
                        </div>
                        <Button
                            onClick={handleDownload}
                            className="w-full gap-2 bg-[#556830] hover:bg-[#203622]"
                        >
                            <Download className="size-4" />
                            Download Password File
                        </Button>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        <ResidentList residents={residents} />
                        <CountConfirmInput
                            count={residents.length}
                            value={confirmInput}
                            onChange={setConfirmInput}
                        />
                    </div>
                )}
                <DialogFooter>
                    {results ? (
                        <Button
                            onClick={() => handleClose(false)}
                            className="bg-[#556830] hover:bg-[#203622]"
                        >
                            Done
                        </Button>
                    ) : (
                        <>
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
                        </>
                    )}
                </DialogFooter>
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
                    ? `${success_count} resident(s) deactivated, ${failed_count} failed`
                    : `${success_count} resident(s) deactivated`;
            toaster(msg, failed_count > 0 ? ToastState.error : ToastState.success);
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
                        You are about to deactivate {residents.length}{' '}
                        resident(s).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="size-5 text-orange-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-orange-800">
                            All selected residents will be withdrawn from
                            active classes and programs. Their accounts will
                            be locked and marked as Deactivated.
                        </div>
                    </div>
                    <ResidentList residents={residents} />
                    <CountConfirmInput
                        count={residents.length}
                        value={confirmInput}
                        onChange={setConfirmInput}
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
                        Deactivate {residents.length} Resident(s)
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
                    ? `${success_count} resident(s) deleted, ${failed_count} failed`
                    : `${success_count} resident(s) deleted`;
            toaster(msg, failed_count > 0 ? ToastState.error : ToastState.success);
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
                        Are you sure you want to delete {residents.length}{' '}
                        resident(s)?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-red-600 font-medium">
                        This action cannot be undone. All data associated
                        with these residents will be permanently deleted.
                    </p>
                    <ResidentList residents={residents} />
                    <CountConfirmInput
                        count={residents.length}
                        value={confirmInput}
                        onChange={setConfirmInput}
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
                        variant="destructive"
                    >
                        Delete {residents.length} Resident(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
