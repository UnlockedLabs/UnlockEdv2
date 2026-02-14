import { useState } from 'react';
import useSWR from 'swr';
import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ProviderResponse,
    OidcClient,
    ServerResponseMany
} from '@/types';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    PlusIcon,
    EllipsisVerticalIcon,
    ServerStackIcon,
    GlobeAltIcon,
    PencilSquareIcon,
    ArrowPathIcon,
    ArchiveBoxIcon,
    KeyIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

const providerTypeLabels: Record<ProviderPlatformType, string> = {
    [ProviderPlatformType.CANVAS_CLOUD]: 'Canvas Cloud',
    [ProviderPlatformType.CANVAS_OSS]: 'Canvas OSS',
    [ProviderPlatformType.KOLIBRI]: 'Kolibri',
    [ProviderPlatformType.BRIGHTSPACE]: 'Brightspace'
};

const providerStateStyles: Record<ProviderPlatformState, string> = {
    [ProviderPlatformState.ENABLED]:
        'bg-green-50 text-green-700 border-green-200',
    [ProviderPlatformState.DISABLED]:
        'bg-gray-50 text-gray-700 border-gray-200',
    [ProviderPlatformState.ARCHIVED]: 'bg-red-50 text-red-700 border-red-200'
};

function ProviderCard({
    provider,
    onEdit,
    onArchiveToggle,
    onRefreshToken,
    onRegisterOidc,
    onShowAuthInfo
}: {
    provider: ProviderPlatform;
    onEdit: (p: ProviderPlatform) => void;
    onArchiveToggle: (p: ProviderPlatform) => void;
    onRefreshToken: (p: ProviderPlatform) => void;
    onRegisterOidc: (p: ProviderPlatform) => void;
    onShowAuthInfo: (p: ProviderPlatform) => void;
}) {
    const isArchived = provider.state === ProviderPlatformState.ARCHIVED;
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="rounded-lg p-2.5 bg-[#E2E7EA]">
                    <GlobeAltIcon className="size-6 text-[#203622]" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-[#203622]">
                            {provider.name}
                        </p>
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${providerStateStyles[provider.state]}`}>
                            {provider.state}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">
                        {providerTypeLabels[provider.type] ?? provider.type}
                    </p>
                    <p className="text-xs text-gray-400">{provider.base_url}</p>
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <EllipsisVerticalIcon className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(provider)}>
                        <PencilSquareIcon className="size-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                    {!provider.oidc_id && (
                        <DropdownMenuItem
                            onClick={() => onRegisterOidc(provider)}
                        >
                            <KeyIcon className="size-4 mr-2" />
                            Register OIDC Client
                        </DropdownMenuItem>
                    )}
                    {provider.oidc_id > 0 && (
                        <DropdownMenuItem
                            onClick={() => onShowAuthInfo(provider)}
                        >
                            <InformationCircleIcon className="size-4 mr-2" />
                            Authorization Info
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        onClick={() => onRefreshToken(provider)}
                    >
                        <ArrowPathIcon className="size-4 mr-2" />
                        Refresh Token
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => onArchiveToggle(provider)}
                    >
                        <ArchiveBoxIcon className="size-4 mr-2" />
                        {isArchived ? 'Enable' : 'Archive'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export default function ProviderPlatformManagement() {
    const { user } = useAuth();
    const [editProvider, setEditProvider] = useState<ProviderPlatform | null>(
        null
    );
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOidcModal, setShowOidcModal] = useState(false);
    const [showOidcInfoModal, setShowOidcInfoModal] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [archiveTarget, setArchiveTarget] =
        useState<ProviderPlatform | null>(null);
    const [oidcClient, setOidcClient] = useState<OidcClient | null>(null);

    const {
        data: providers,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<ProviderPlatform>>(`/api/provider-platforms`);

    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) {
        return null;
    }

    const providerData = providers?.data ?? [];

    const handleArchiveToggle = async (provider: ProviderPlatform) => {
        const newState =
            provider.state === ProviderPlatformState.ARCHIVED
                ? 'enabled'
                : 'archived';
        const resp = await API.patch<ProviderResponse, { state: string }>(
            `provider-platforms/${provider.id}`,
            { state: newState }
        );
        if (resp.success) {
            const data = resp.data as ProviderResponse;
            if (data.oauth2Url) {
                window.location.href = data.oauth2Url;
                return;
            }
            toast.success(
                `Provider "${provider.name}" has been ${newState}.`
            );
            void mutate();
        } else {
            toast.error('Unable to toggle provider state.');
        }
        setShowArchiveConfirm(false);
        setArchiveTarget(null);
    };

    const handleRefreshToken = async (provider: ProviderPlatform) => {
        try {
            const resp = await API.get<ProviderResponse>(
                `provider-platforms/${provider.id}/refresh`
            );
            if (resp.success) {
                const data = resp.data as ProviderResponse;
                if (data.oauth2Url) {
                    window.location.href = data.oauth2Url;
                }
            } else {
                toast.error(
                    `Unable to refresh token for ${provider.name}.`
                );
            }
        } catch {
            toast.error(
                `Unable to refresh token for ${provider.name}.`
            );
        }
    };

    const handleShowAuthInfo = async (provider: ProviderPlatform) => {
        try {
            const resp = await API.get<OidcClient>(
                `oidc/clients/${provider.oidc_id}`
            );
            if (resp.success) {
                setOidcClient(resp.data as OidcClient);
                setShowOidcInfoModal(true);
            }
        } catch {
            toast.error('Unable to fetch authorization info.');
        }
    };

    if (isLoading) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className="h-24 w-full rounded-lg"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title="Learning Platforms"
                    subtitle="Manage connected learning management systems"
                    actions={
                        <Button
                            onClick={() => setShowAddModal(true)}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            <PlusIcon className="size-4 mr-1" />
                            Add Learning Platform
                        </Button>
                    }
                />

                {error ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                        <p className="text-red-600">
                            Error loading provider platforms.
                        </p>
                    </div>
                ) : providerData.length === 0 ? (
                    <EmptyState
                        icon={
                            <ServerStackIcon className="size-6 text-[#203622]" />
                        }
                        title="No learning platforms"
                        description="Connect your first learning management system to get started."
                        action={
                            <Button
                                onClick={() => setShowAddModal(true)}
                                className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            >
                                <PlusIcon className="size-4 mr-1" />
                                Add Learning Platform
                            </Button>
                        }
                    />
                ) : (
                    <div className="space-y-4">
                        {providerData.map((provider) => (
                            <ProviderCard
                                key={provider.id}
                                provider={provider}
                                onEdit={(p) => {
                                    setEditProvider(p);
                                    setShowEditModal(true);
                                }}
                                onArchiveToggle={(p) => {
                                    setArchiveTarget(p);
                                    setShowArchiveConfirm(true);
                                }}
                                onRefreshToken={(p) =>
                                    void handleRefreshToken(p)
                                }
                                onRegisterOidc={(p) => {
                                    setEditProvider(p);
                                    setShowOidcModal(true);
                                }}
                                onShowAuthInfo={(p) =>
                                    void handleShowAuthInfo(p)
                                }
                            />
                        ))}
                    </div>
                )}
            </div>

            <AddProviderModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                onSuccess={() => void mutate()}
            />

            <EditProviderModal
                open={showEditModal}
                onOpenChange={setShowEditModal}
                provider={editProvider}
                onSuccess={() => void mutate()}
            />

            <RegisterOidcModal
                open={showOidcModal}
                onOpenChange={setShowOidcModal}
                provider={editProvider}
                onSuccess={(client) => {
                    setShowOidcModal(false);
                    setOidcClient(client);
                    setShowOidcInfoModal(true);
                    void mutate();
                }}
            />

            <OidcInfoModal
                open={showOidcInfoModal}
                onOpenChange={(open) => {
                    setShowOidcInfoModal(open);
                    if (!open) setOidcClient(null);
                }}
                oidcClient={oidcClient}
            />

            <ConfirmDialog
                open={showArchiveConfirm}
                onOpenChange={setShowArchiveConfirm}
                title={
                    archiveTarget?.state === ProviderPlatformState.ARCHIVED
                        ? 'Enable Provider'
                        : 'Archive Provider'
                }
                description={
                    archiveTarget?.state === ProviderPlatformState.ARCHIVED
                        ? `Are you sure you want to re-enable "${archiveTarget?.name}"?`
                        : `Are you sure you want to archive "${archiveTarget?.name}"? This will disable syncing.`
                }
                confirmLabel={
                    archiveTarget?.state === ProviderPlatformState.ARCHIVED
                        ? 'Enable'
                        : 'Archive'
                }
                onConfirm={() =>
                    archiveTarget && void handleArchiveToggle(archiveTarget)
                }
                variant={
                    archiveTarget?.state === ProviderPlatformState.ARCHIVED
                        ? 'default'
                        : 'destructive'
                }
            />
        </div>
    );
}

function AddProviderModal({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<ProviderPlatformType>(
        ProviderPlatformType.CANVAS_CLOUD
    );
    const [baseUrl, setBaseUrl] = useState('');
    const [accountId, setAccountId] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setName('');
        setType(ProviderPlatformType.CANVAS_CLOUD);
        setBaseUrl('');
        setAccountId('');
        setAccessKey('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const resp = await API.post<ProviderResponse, object>(
            'provider-platforms',
            {
                name,
                type,
                base_url: baseUrl,
                account_id: accountId,
                access_key: accessKey,
                state: 'enabled'
            }
        );
        setSubmitting(false);
        if (resp.success) {
            const data = resp.data as ProviderResponse;
            if (data.oauth2Url) {
                window.location.href = data.oauth2Url;
                return;
            }
            toast.success('Provider platform added successfully.');
            resetForm();
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error('Failed to add provider platform.');
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) resetForm();
            }}
            title="Add Learning Platform"
            description="Connect a new learning management system."
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Platform Type
                    </label>
                    <select
                        value={type}
                        onChange={(e) =>
                            setType(e.target.value as ProviderPlatformType)
                        }
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                        {Object.entries(providerTypeLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Base URL
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        placeholder="https://your-lms.example.com"
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Account ID
                    </label>
                    <input
                        type="text"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Access Key
                    </label>
                    <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            resetForm();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#203622] text-white hover:bg-[#203622]/90"
                    >
                        {submitting ? 'Adding...' : 'Add Platform'}
                    </Button>
                </div>
            </form>
        </FormModal>
    );
}

function EditProviderModal({
    open,
    onOpenChange,
    provider,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    provider: ProviderPlatform | null;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [accountId, setAccountId] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const populateForm = () => {
        if (provider) {
            setName(provider.name);
            setBaseUrl(provider.base_url);
            setAccountId(provider.account_id);
            setAccessKey(provider.access_key);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!provider) return;
        setSubmitting(true);
        const resp = await API.patch<ProviderResponse, object>(
            `provider-platforms/${provider.id}`,
            {
                name,
                base_url: baseUrl,
                account_id: accountId,
                access_key: accessKey
            }
        );
        setSubmitting(false);
        if (resp.success) {
            const data = resp.data as ProviderResponse;
            if (data.oauth2Url) {
                window.location.href = data.oauth2Url;
                return;
            }
            toast.success('Provider platform updated.');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error('Failed to update provider platform.');
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (v) populateForm();
            }}
            title="Edit Learning Platform"
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Base URL
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Account ID
                    </label>
                    <input
                        type="text"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Access Key
                    </label>
                    <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#203622] text-white hover:bg-[#203622]/90"
                    >
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </FormModal>
    );
}

function RegisterOidcModal({
    open,
    onOpenChange,
    provider,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    provider: ProviderPlatform | null;
    onSuccess: (client: OidcClient) => void;
}) {
    const [redirectUrl, setRedirectUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!provider) return;
        setSubmitting(true);
        const resp = await API.post<OidcClient, object>(
            `oidc/clients/${provider.id}`,
            { redirect_url: redirectUrl }
        );
        setSubmitting(false);
        if (resp.success) {
            onSuccess(resp.data as OidcClient);
            setRedirectUrl('');
        } else {
            toast.error('Failed to register OIDC client.');
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Register OIDC Client"
            description={`Register an OIDC client for ${provider?.name ?? 'this provider'}.`}
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-[#203622]">
                        Redirect URL
                    </label>
                    <input
                        type="url"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        required
                        placeholder="https://your-lms.example.com/oauth/callback"
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#203622] text-white hover:bg-[#203622]/90"
                    >
                        {submitting ? 'Registering...' : 'Register'}
                    </Button>
                </div>
            </form>
        </FormModal>
    );
}

function OidcInfoModal({
    open,
    onOpenChange,
    oidcClient
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    oidcClient: OidcClient | null;
}) {
    if (!oidcClient) return null;

    const fields = [
        { label: 'Client ID', value: oidcClient.client_id },
        { label: 'Client Secret', value: oidcClient.client_secret },
        { label: 'Authorization Endpoint', value: oidcClient.auth_url },
        { label: 'Token Endpoint', value: oidcClient.token_url },
        { label: 'Scopes', value: oidcClient.scope }
    ];

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="OIDC Client Registration"
            description="Save the following credentials. The client secret will not be shown again."
        >
            <div className="space-y-3">
                {fields.map((field) => (
                    <div
                        key={field.label}
                        className="flex flex-col gap-1 rounded-md bg-gray-50 p-3"
                    >
                        <span className="text-xs font-medium text-gray-500">
                            {field.label}
                        </span>
                        <span className="text-sm font-mono text-[#203622] break-all">
                            {field.value}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex justify-end pt-4">
                <Button
                    onClick={() => onOpenChange(false)}
                    className="bg-[#203622] text-white hover:bg-[#203622]/90"
                >
                    Close
                </Button>
            </div>
        </FormModal>
    );
}
