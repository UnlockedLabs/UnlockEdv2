import { useState, useEffect } from 'react';
import API from '@/api/api';
import {
    User,
    BulkPasswordResult,
    BulkPasswordResponse,
    BulkActionFailure,
    BulkActionResponse,
    ServerResponseOne,
    ToastState
} from '@/types';
import { useToast } from '@/contexts/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { FormModal, TonedPanel } from '@/components/shared';
import { useTypeToConfirm } from '@/components/shared/useTypeToConfirm';
import { AlertCircle, CheckCircle, Download } from 'lucide-react';

interface BulkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residents: User[];
    onSuccess: () => void;
}

interface BulkResetPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: User[];
    onSuccess: () => void;
    kind?: 'resident' | 'admin';
}

function formatNameLastFirst(r: User) {
    return `${r.name_last}, ${r.name_first}`;
}

interface BulkResetConfig {
    singular: string;
    plural: string;
    heading: string;
    distributeNote: string;
    displayItem: (u: User) => string;
    csvHeader: string;
    csvRow: (r: BulkPasswordResult) => string;
    csvFilenamePrefix: string;
}

const RESIDENT_CONFIG: BulkResetConfig = {
    singular: 'resident',
    plural: 'residents',
    heading: 'Selected Residents',
    distributeNote: 'distribute to residents',
    displayItem: (u) => `${formatNameLastFirst(u)} (${u.doc_id ?? ''})`,
    csvHeader: 'Resident ID,Name,Username,Temporary Password',
    csvRow: (r) => `${r.doc_id},${r.name},${r.username},${r.temp_password}`,
    csvFilenamePrefix: 'bulk-passwords'
};

const ADMIN_CONFIG: BulkResetConfig = {
    singular: 'admin',
    plural: 'admins',
    heading: 'Selected Admins',
    distributeNote: 'distribute to admins',
    displayItem: (u) => `${formatNameLastFirst(u)} (${u.username})`,
    csvHeader: 'Username,Name,Temporary Password',
    csvRow: (r) => `${r.username},${r.name},${r.temp_password}`,
    csvFilenamePrefix: 'bulk-admin-passwords'
};

export function BulkResetPasswordDialog({
    open,
    onOpenChange,
    users,
    onSuccess,
    kind = 'resident'
}: BulkResetPasswordDialogProps) {
    const { toaster } = useToast();
    const cfg = kind === 'admin' ? ADMIN_CONFIG : RESIDENT_CONFIG;
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [results, setResults] = useState<BulkPasswordResult[]>([]);
    const [failures, setFailures] = useState<BulkActionFailure[]>([]);
    const confirm = useTypeToConfirm({
        open,
        expected: String(users.length)
    });

    useEffect(() => {
        if (!open) {
            setCompleted(false);
            setResults([]);
            setFailures([]);
        }
    }, [open]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const response = (await API.post<BulkPasswordResponse, object>(
                'users/bulk/reset-password',
                { user_ids: users.map((u) => u.id) }
            )) as ServerResponseOne<BulkPasswordResponse>;
            if (response.success) {
                setResults(response.data.successes ?? []);
                setFailures(response.data.failures ?? []);
                setCompleted(true);
            } else {
                toaster(
                    response.message ?? 'Failed to reset passwords',
                    ToastState.error
                );
            }
        } catch {
            toaster('Failed to reset passwords', ToastState.error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (results.length === 0) return;
        const csv = [cfg.csvHeader, ...results.map(cfg.csvRow)].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cfg.csvFilenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toaster('Password file downloaded', ToastState.success);
        onSuccess();
        onOpenChange(false);
    };

    const handleClose = (value: boolean) => {
        if (!value && completed) {
            onSuccess();
        }
        onOpenChange(value);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title="Bulk Reset Passwords"
            description={`Generate new temporary passwords for ${users.length} selected ${cfg.singular}${users.length > 1 ? 's' : ''}`}
            className="max-w-2xl"
            titleClassName="text-foreground"
            preventOutsideClose
        >
            {!completed ? (
                <>
                    <TonedPanel tone="blue">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="font-medium text-sm text-blue-900 mb-1">
                                    {cfg.heading}
                                </div>
                                <p className="text-sm text-blue-800 mb-2">
                                    New temporary passwords will be generated
                                    for:
                                </p>
                                <div className="bg-white border border-blue-200 rounded p-3 max-h-48 overflow-y-auto">
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        {users.map((u) => (
                                            <li key={u.id}>
                                                {'•'} {cfg.displayItem(u)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <p className="text-sm text-blue-800 mt-3">
                                    You will need to distribute these passwords
                                    securely.
                                </p>
                            </div>
                        </div>
                    </TonedPanel>

                    <div className="space-y-2">
                        <Label htmlFor="bulk-reset-confirm">
                            Type{' '}
                            <span className="font-mono font-semibold">
                                {users.length}
                            </span>{' '}
                            to confirm
                        </Label>
                        <Input
                            id="bulk-reset-confirm"
                            {...confirm.inputProps}
                            placeholder={`Type ${users.length}`}
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
                            disabled={!confirm.matches || loading}
                            variant="brand"
                        >
                            {loading ? 'Generating...' : 'Generate Passwords'}
                        </Button>
                    </DialogFooter>
                </>
            ) : (
                <>
                    <TonedPanel tone="green">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="size-5 text-green-600" />
                            <div>
                                <div className="font-medium text-sm text-green-900">
                                    Passwords Generated
                                </div>
                                <p className="text-sm text-green-700 mt-1">
                                    {results.length} temporary password
                                    {results.length !== 1 ? 's' : ''} created.
                                    Download the CSV file to{' '}
                                    {cfg.distributeNote}.
                                </p>
                            </div>
                        </div>
                    </TonedPanel>

                    {failures.length > 0 && (
                        <TonedPanel tone="red">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="font-medium text-sm text-red-900 mb-1">
                                        {failures.length} failed
                                    </div>
                                    <div className="bg-white border border-red-200 rounded p-3 max-h-32 overflow-y-auto">
                                        <ul className="text-sm text-gray-700 space-y-1">
                                            {failures.map((f) => (
                                                <li key={f.user_id}>
                                                    {'•'} {f.name} ({f.username}
                                                    ): {f.reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </TonedPanel>
                    )}

                    <DialogFooter>
                        {results.length > 0 ? (
                            <Button onClick={handleDownload} variant="brand">
                                <Download className="size-4 mr-2" />
                                Download Password File
                            </Button>
                        ) : (
                            <Button
                                onClick={() => handleClose(false)}
                                variant="brand"
                            >
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </>
            )}
        </FormModal>
    );
}

export function BulkDeactivateDialog({
    open,
    onOpenChange,
    residents,
    onSuccess
}: BulkDialogProps) {
    const { toaster } = useToast();
    const [loading, setLoading] = useState(false);
    const confirm = useTypeToConfirm({
        open,
        expected: String(residents.length)
    });

    const handleDeactivate = async () => {
        setLoading(true);
        const response = (await API.post<BulkActionResponse, object>(
            'users/bulk/deactivate',
            {
                user_ids: residents.map((r) => r.id)
            }
        )) as ServerResponseOne<BulkActionResponse>;
        setLoading(false);

        if (response.success) {
            const { success_count, failures } = response.data;
            const failedCount = failures?.length ?? 0;
            const failedNames = failures?.map((f) => f.name).join(', ');
            const msg =
                failedCount > 0
                    ? `${success_count} resident${success_count !== 1 ? 's' : ''} deactivated, ${failedCount} failed: ${failedNames}`
                    : `${success_count} resident${success_count !== 1 ? 's' : ''} deactivated`;
            toaster(
                msg,
                failedCount > 0 ? ToastState.error : ToastState.success
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
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Deactivate Residents"
            description={`Deactivate ${residents.length} selected resident${residents.length > 1 ? 's' : ''}`}
            titleClassName="text-foreground"
            preventOutsideClose
        >
            <TonedPanel tone="orange">
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
                                        {'•'} {formatNameLastFirst(r)} (
                                        {r.doc_id ?? ''})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </TonedPanel>

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
                    {...confirm.inputProps}
                    placeholder={`Type ${residents.length}`}
                />
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button
                    onClick={() => void handleDeactivate()}
                    disabled={!confirm.matches || loading}
                    variant="warning"
                >
                    Deactivate {residents.length} Accounts
                </Button>
            </DialogFooter>
        </FormModal>
    );
}

interface BulkDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: User[];
    onSuccess: () => void;
    kind?: 'resident' | 'admin';
}

interface BulkDeleteConfig {
    singular: string;
    plural: string;
    title: string;
    bodyDescription: (count: number) => string;
    displayItem: (u: User) => string;
}

const RESIDENT_DELETE_CONFIG: BulkDeleteConfig = {
    singular: 'resident',
    plural: 'residents',
    title: 'Delete Residents',
    bodyDescription: () =>
        'These resident accounts and all associated data will be permanently deleted:',
    displayItem: (u) => `${formatNameLastFirst(u)} (${u.doc_id ?? ''})`
};

const ADMIN_DELETE_CONFIG: BulkDeleteConfig = {
    singular: 'admin',
    plural: 'admins',
    title: 'Delete Admins',
    bodyDescription: () =>
        'These admin accounts and all associated data will be permanently deleted:',
    displayItem: (u) => `${formatNameLastFirst(u)} (${u.username})`
};

export function BulkDeleteDialog({
    open,
    onOpenChange,
    users,
    onSuccess,
    kind = 'resident'
}: BulkDeleteDialogProps) {
    const { toaster } = useToast();
    const cfg = kind === 'admin' ? ADMIN_DELETE_CONFIG : RESIDENT_DELETE_CONFIG;
    const [loading, setLoading] = useState(false);
    const confirm = useTypeToConfirm({
        open,
        expected: String(users.length)
    });

    const handleDelete = async () => {
        setLoading(true);
        try {
            const response = (await API.post<BulkActionResponse, object>(
                'users/bulk/delete',
                { user_ids: users.map((u) => u.id) }
            )) as ServerResponseOne<BulkActionResponse>;

            if (response.success) {
                const { success_count, failures } = response.data;
                const failedCount = failures?.length ?? 0;
                const failedNames = failures?.map((f) => f.name).join(', ');
                const label = success_count !== 1 ? cfg.plural : cfg.singular;
                const msg =
                    failedCount > 0
                        ? `${success_count} ${label} deleted, ${failedCount} failed: ${failedNames}`
                        : `${success_count} ${label} deleted`;
                toaster(
                    msg,
                    failedCount > 0 ? ToastState.error : ToastState.success
                );
                onOpenChange(false);
                onSuccess();
            } else {
                toaster(
                    response.message ?? `Failed to delete ${cfg.plural}`,
                    ToastState.error
                );
            }
        } catch {
            toaster(`Failed to delete ${cfg.plural}`, ToastState.error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title={cfg.title}
            description={`Permanently delete ${users.length} selected ${cfg.singular}${users.length > 1 ? 's' : ''}`}
            titleClassName="text-foreground"
            preventOutsideClose
        >
            <TonedPanel tone="red">
                <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="font-medium text-sm text-red-900 mb-1">
                            This action cannot be undone
                        </div>
                        <p className="text-sm text-red-800 mb-2">
                            {cfg.bodyDescription(users.length)}
                        </p>
                        <div className="bg-white border border-red-200 rounded p-3 max-h-48 overflow-y-auto">
                            <ul className="text-sm text-gray-700 space-y-1">
                                {users.map((u) => (
                                    <li key={u.id}>
                                        {'•'} {cfg.displayItem(u)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </TonedPanel>

            <div className="space-y-2">
                <Label htmlFor="bulk-delete-confirm">
                    Type{' '}
                    <span className="font-mono font-semibold">
                        {users.length}
                    </span>{' '}
                    to confirm deletion
                </Label>
                <Input
                    id="bulk-delete-confirm"
                    {...confirm.inputProps}
                    placeholder={`Type ${users.length}`}
                />
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button
                    onClick={() => void handleDelete()}
                    disabled={!confirm.matches || loading}
                    className="bg-red-600 hover:bg-red-700"
                >
                    {loading
                        ? 'Deleting...'
                        : `Delete ${users.length} ${
                              users.length === 1 ? cfg.singular : cfg.plural
                          }`}
                </Button>
            </DialogFooter>
        </FormModal>
    );
}
