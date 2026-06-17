import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import API from '@/api/api';
import {
    User,
    BulkPasswordResult,
    BulkPasswordResponse,
    BulkActionFailure,
    BulkActionResponse,
    ServerResponseOne
} from '@/types';
import { buildConfirmCountSchema, ConfirmCountInput } from '@/lib/validation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { FormModal, TonedPanel } from '@/components/shared';
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
    const cfg = kind === 'admin' ? ADMIN_CONFIG : RESIDENT_CONFIG;
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [results, setResults] = useState<BulkPasswordResult[]>([]);
    const [failures, setFailures] = useState<BulkActionFailure[]>([]);
    const schema = useMemo(
        () => buildConfirmCountSchema(String(users.length)),
        [users.length]
    );
    const form = useForm<ConfirmCountInput>({
        resolver: zodResolver(schema),
        defaultValues: { confirm: '' }
    });

    useEffect(() => {
        if (!open) {
            setCompleted(false);
            setResults([]);
            setFailures([]);
            form.reset({ confirm: '' });
        }
    }, [open, form]);

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
                toast.error(response.message ?? 'Failed to reset passwords');
            }
        } catch {
            toast.error('Failed to reset passwords');
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
        toast.success('Password file downloaded');
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
                <Form {...form}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void form.handleSubmit(() => void handleGenerate())(
                                e
                            );
                        }}
                    >
                        <TonedPanel tone="blue">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="size-5 text-blue-600 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <div className="font-medium text-sm text-blue-900 mb-1">
                                        {cfg.heading}
                                    </div>
                                    <p className="text-sm text-blue-800 mb-2">
                                        New temporary passwords will be
                                        generated for:
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
                                        You will need to distribute these
                                        passwords securely.
                                    </p>
                                </div>
                            </div>
                        </TonedPanel>

                        <FormField
                            control={form.control}
                            name="confirm"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel htmlFor="bulk-reset-confirm">
                                        Type{' '}
                                        <span className="font-mono font-semibold">
                                            {users.length}
                                        </span>{' '}
                                        to confirm
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="bulk-reset-confirm"
                                            placeholder={`Type ${users.length}`}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                variant="brand"
                            >
                                {loading
                                    ? 'Generating...'
                                    : 'Generate Passwords'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
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
                                <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
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
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => handleClose(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={handleDownload}
                                    variant="brand"
                                >
                                    <Download className="size-4 mr-2" />
                                    Download Password File
                                </Button>
                            </>
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
    const [loading, setLoading] = useState(false);
    const schema = useMemo(
        () => buildConfirmCountSchema(String(residents.length)),
        [residents.length]
    );
    const form = useForm<ConfirmCountInput>({
        resolver: zodResolver(schema),
        defaultValues: { confirm: '' }
    });

    useEffect(() => {
        if (!open) form.reset({ confirm: '' });
    }, [open, form]);

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
            if (failedCount > 0) toast.error(msg);
            else toast.success(msg);
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(response.message ?? 'Failed to deactivate residents');
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
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(() => void handleDeactivate())(
                            e
                        );
                    }}
                >
                    <TonedPanel tone="orange">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-orange-600 mt-0.5 shrink-0" />
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

                    <FormField
                        control={form.control}
                        name="confirm"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel htmlFor="bulk-deactivate-confirm">
                                    Type{' '}
                                    <span className="font-mono font-semibold">
                                        {residents.length}
                                    </span>{' '}
                                    to confirm
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        id="bulk-deactivate-confirm"
                                        placeholder={`Type ${residents.length}`}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            variant="warning"
                        >
                            Deactivate {residents.length} Accounts
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
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
    const cfg = kind === 'admin' ? ADMIN_DELETE_CONFIG : RESIDENT_DELETE_CONFIG;
    const [loading, setLoading] = useState(false);
    const schema = useMemo(
        () => buildConfirmCountSchema(String(users.length)),
        [users.length]
    );
    const form = useForm<ConfirmCountInput>({
        resolver: zodResolver(schema),
        defaultValues: { confirm: '' }
    });

    useEffect(() => {
        if (!open) form.reset({ confirm: '' });
    }, [open, form]);

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
                if (failedCount > 0) toast.error(msg);
                else toast.success(msg);
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(
                    response.message ?? `Failed to delete ${cfg.plural}`
                );
            }
        } catch {
            toast.error(`Failed to delete ${cfg.plural}`);
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
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(() => void handleDelete())(e);
                    }}
                >
                    <TonedPanel tone="red">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
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

                    <FormField
                        control={form.control}
                        name="confirm"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel htmlFor="bulk-delete-confirm">
                                    Type{' '}
                                    <span className="font-mono font-semibold">
                                        {users.length}
                                    </span>{' '}
                                    to confirm deletion
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        id="bulk-delete-confirm"
                                        placeholder={`Type ${users.length}`}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {loading
                                ? 'Deleting...'
                                : `Delete ${users.length} ${
                                      users.length === 1
                                          ? cfg.singular
                                          : cfg.plural
                                  }`}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </FormModal>
    );
}
