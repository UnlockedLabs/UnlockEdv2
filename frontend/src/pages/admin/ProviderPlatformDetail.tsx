import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ProviderResponse,
    OidcClient,
    ServerResponseOne
} from '@/types';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
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
    EllipsisVerticalIcon,
    PencilSquareIcon,
    ArrowPathIcon,
    ArchiveBoxIcon,
    KeyIcon,
    InformationCircleIcon,
    UsersIcon,
    ChevronLeftIcon
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
        'bg-[#E2E7EA] text-foreground border-border',
    [ProviderPlatformState.ARCHIVED]: 'bg-red-50 text-red-700 border-red-200'
};

export default function ProviderPlatformDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [editProvider, setEditProvider] = useState<ProviderPlatform | null>(
        null
    );
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOidcModal, setShowOidcModal] = useState(false);
    const [showOidcInfoModal, setShowOidcInfoModal] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [oidcClient, setOidcClient] = useState<OidcClient | null>(null);

    const {
        data: providerResp,
        mutate,
        isLoading,
        error
    } = useSWR<ServerResponseOne<ProviderPlatform>>(
        id ? `/api/provider-platforms/${id}` : null
    );
    const provider = providerResp?.data;

    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) return null;

    const handleArchiveToggle = async () => {
        if (!provider) return;
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
            toast.success(`Provider "${provider.name}" has been ${newState}.`);
            void mutate();
        } else {
            toast.error('Unable to toggle provider state.');
        }
        setShowArchiveConfirm(false);
    };

    const handleRefreshToken = async () => {
        if (!provider) return;
        const resp = await API.get<ProviderResponse>(
            `provider-platforms/${provider.id}/refresh`
        );
        if (resp.success) {
            const data = resp.data as ProviderResponse;
            if (data.oauth2Url) {
                window.location.href = data.oauth2Url;
            }
        } else {
            toast.error(`Unable to refresh token for ${provider.name}.`);
        }
    };

    const handleShowAuthInfo = async () => {
        if (!provider) return;
        const resp = await API.get<OidcClient>(
            `oidc/clients/${provider.oidc_id}`
        );
        if (resp.success) {
            setOidcClient(resp.data as OidcClient);
            setShowOidcInfoModal(true);
        } else {
            toast.error('Unable to fetch authorization info.');
        }
    };

    if (isLoading) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    if (error || !provider) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <p className="text-red-600">
                            Error loading provider platform.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => navigate('/learning-platforms')}
                        >
                            Back to Learning Platforms
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const isArchived = provider.state === ProviderPlatformState.ARCHIVED;

    const infoFields = [
        {
            label: 'Type',
            value: providerTypeLabels[provider.type] ?? provider.type
        },
        { label: 'Base URL', value: provider.base_url },
        { label: 'Account ID', value: provider.account_id }
    ];

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <button
                        onClick={() => navigate('/learning-platforms')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        <ChevronLeftIcon className="size-4" />
                        Learning Platforms
                    </button>
                </div>

                <PageHeader
                    title={provider.name}
                    actions={
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    navigate(`/provider-users/${provider.id}`)
                                }
                            >
                                <UsersIcon className="size-4 mr-2" />
                                Manage Users
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <EllipsisVerticalIcon className="size-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditProvider(provider);
                                            setShowEditModal(true);
                                        }}
                                    >
                                        <PencilSquareIcon className="size-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    {!provider.oidc_id && (
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setEditProvider(provider);
                                                setShowOidcModal(true);
                                            }}
                                        >
                                            <KeyIcon className="size-4 mr-2" />
                                            Register OIDC Client
                                        </DropdownMenuItem>
                                    )}
                                    {provider.oidc_id > 0 && (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                void handleShowAuthInfo()
                                            }
                                        >
                                            <InformationCircleIcon className="size-4 mr-2" />
                                            Authorization Info
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        onClick={() =>
                                            void handleRefreshToken()
                                        }
                                    >
                                        <ArrowPathIcon className="size-4 mr-2" />
                                        Refresh Token
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() =>
                                            setShowArchiveConfirm(true)
                                        }
                                    >
                                        <ArchiveBoxIcon className="size-4 mr-2" />
                                        {isArchived ? 'Enable' : 'Archive'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    }
                />

                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-sm font-semibold text-foreground">
                            Platform Details
                        </h2>
                        <span
                            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${providerStateStyles[provider.state]}`}
                        >
                            {provider.state}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {infoFields.map((f) => (
                            <div
                                key={f.label}
                                className="flex flex-col gap-1 rounded-md bg-[#E2E7EA] p-3"
                            >
                                <span className="text-xs font-medium text-muted-foreground">
                                    {f.label}
                                </span>
                                <span className="text-sm text-foreground break-all">
                                    {f.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {provider.oidc_id > 0 ? (
                    <OidcInfoSection oidcId={provider.oidc_id} />
                ) : (
                    <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                OIDC Not Registered
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Register an OIDC client to enable single
                                sign-on.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEditProvider(provider);
                                setShowOidcModal(true);
                            }}
                        >
                            <KeyIcon className="size-4 mr-2" />
                            Register OIDC Client
                        </Button>
                    </div>
                )}
            </div>

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
                title={isArchived ? 'Enable Provider' : 'Archive Provider'}
                description={
                    isArchived
                        ? `Are you sure you want to re-enable "${provider.name}"?`
                        : `Are you sure you want to archive "${provider.name}"? This will disable syncing.`
                }
                confirmLabel={isArchived ? 'Enable' : 'Archive'}
                onConfirm={() => void handleArchiveToggle()}
                variant={isArchived ? 'default' : 'destructive'}
            />
        </div>
    );
}

function OidcInfoSection({ oidcId }: { oidcId: number }) {
    const { data: oidcResp } = useSWR<ServerResponseOne<OidcClient>>(
        `/api/oidc/clients/${oidcId}`
    );
    const client = oidcResp?.data;

    if (!client) {
        return (
            <div className="bg-card rounded-lg border border-border p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                </div>
            </div>
        );
    }

    const fields = [
        { label: 'Client ID', value: client.client_id },
        { label: 'Client Secret', value: client.client_secret },
        { label: 'Authorization Endpoint', value: client.auth_url },
        { label: 'Token Endpoint', value: client.token_url },
        { label: 'Scopes', value: client.scope }
    ];

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
                OIDC Configuration
            </h2>
            <div className="space-y-3">
                {fields.map((f) => (
                    <div
                        key={f.label}
                        className="flex flex-col gap-1 rounded-md bg-[#E2E7EA] p-3"
                    >
                        <span className="text-xs font-medium text-muted-foreground">
                            {f.label}
                        </span>
                        <span className="text-sm font-mono text-foreground break-all">
                            {f.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
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

    useEffect(() => {
        if (open && provider) {
            setName(provider.name);
            setBaseUrl(provider.base_url);
            setAccountId(provider.account_id);
            setAccessKey('');
        }
    }, [open, provider]);

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
            onOpenChange={onOpenChange}
            title="Edit Learning Platform"
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Base URL
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Account ID
                    </label>
                    <input
                        type="text"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Access Key
                    </label>
                    <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
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
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!provider) return;
        setSubmitting(true);
        const resp = await API.post<OidcClient, object>('oidc/clients', {
            provider_platform_id: provider.id,
            auto_register: true
        });
        setSubmitting(false);
        if (resp.success) {
            onSuccess(resp.data as OidcClient);
        } else {
            toast.error('Failed to register OIDC client.');
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Register OIDC Client"
            description={`Register an OIDC client for ${provider?.name ?? 'this provider'}. The redirect URL will be set automatically from the provider's base URL.`}
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
                        className="flex flex-col gap-1 rounded-md bg-[#E2E7EA] p-3"
                    >
                        <span className="text-xs font-medium text-muted-foreground">
                            {field.label}
                        </span>
                        <span className="text-sm font-mono text-foreground break-all">
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
