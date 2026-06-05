import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { Pagination } from '@/components/Pagination';
import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ProviderResponse,
    ServerResponseMany
} from '@/types';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormModal } from '@/components/shared/FormModal';
import { EnrollmentTypeSelector } from '@/Components/shared/EnrollmentTypeSelector';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    PlusIcon,
    ServerStackIcon,
    GlobeAltIcon
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
    [ProviderPlatformState.DISABLED]: 'bg-muted text-foreground border-border',
    [ProviderPlatformState.ARCHIVED]: 'bg-red-50 text-red-700 border-red-200'
};

export default function ProviderPlatformManagement() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showAddModal, setShowAddModal] = useState(false);
    const { page, perPage, setPage, setPerPage } = useUrlPagination(1, 20);

    const {
        data: providers,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<ProviderPlatform>>(
        `/api/provider-platforms?page=${page}&per_page=${perPage}`
    );

    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) return null;

    const providerData = providers?.data ?? [];
    const totalItems = providers?.meta?.total ?? 0;

    const columns: Column<ProviderPlatform>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (p) => (
                <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2 bg-muted">
                        <GlobeAltIcon className="size-4 text-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                        {p.name}
                    </span>
                </div>
            )
        },
        {
            key: 'type',
            header: 'Type',
            render: (p) => (
                <span className="text-sm text-muted-foreground">
                    {providerTypeLabels[p.type] ?? p.type}
                </span>
            )
        },
        {
            key: 'state',
            header: 'Status',
            render: (p) => (
                <span
                    className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${providerStateStyles[p.state]}`}
                >
                    {p.state}
                </span>
            )
        },
        {
            key: 'base_url',
            header: 'Base URL',
            render: (p) => (
                <span className="text-sm text-muted-foreground">
                    {p.base_url}
                </span>
            )
        }
    ];

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
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <p className="text-red-600">
                            Error loading provider platforms.
                        </p>
                    </div>
                ) : !isLoading && providerData.length === 0 ? (
                    <EmptyState
                        icon={
                            <ServerStackIcon className="size-6 text-foreground" />
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
                    <div>
                        <DataTable
                            columns={columns}
                            data={providerData}
                            keyExtractor={(p) => p.id}
                            isLoading={isLoading}
                            emptyMessage="No learning platforms found."
                            onRowClick={(p) =>
                                navigate(`/learning-platforms/${p.id}`)
                            }
                        />
                        <Pagination
                            currentPage={page}
                            totalItems={totalItems}
                            itemsPerPage={perPage}
                            onPageChange={setPage}
                            onItemsPerPageChange={setPerPage}
                            itemLabel="platforms"
                        />
                    </div>
                )}
            </div>

            <AddProviderModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                onSuccess={() => {
                    setPage(1);
                    void mutate();
                }}
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
    const [accessKey, setAccessKey] = useState('');
    const [enrollmentTypes, setEnrollmentTypes] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const isCanvas =
        type === ProviderPlatformType.CANVAS_CLOUD ||
        type === ProviderPlatformType.CANVAS_OSS;

    const resetForm = () => {
        setName('');
        setType(ProviderPlatformType.CANVAS_CLOUD);
        setBaseUrl('');
        setAccessKey('');
        setEnrollmentTypes([]);
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
                account_id: '1',
                access_key: accessKey,
                state: 'enabled',
                enrollment_types: isCanvas ? enrollmentTypes : []
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
                    <label className="text-sm font-medium text-foreground">
                        Name
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        This is the connection name and will be used as the program name
                    </p>
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
                        Platform Type
                    </label>
                    <select
                        value={type}
                        onChange={(e) =>
                            setType(e.target.value as ProviderPlatformType)
                        }
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    >
                        {Object.entries(providerTypeLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Canvas Instance URL
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        placeholder="https://your-lms.example.com"
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground">
                        Access Token
                    </label>
                    <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        required
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                    {isCanvas && (
                        <div className="mt-2 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">
                                How to create a Canvas personal access token:
                            </p>
                            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                                <li>
                                    Open{' '}
                                    {baseUrl ? (
                                        <a
                                            href={`${baseUrl.replace(/\/$/, '')}/profile/settings`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary underline"
                                        >
                                            {baseUrl.replace(/\/$/, '')}
                                            /profile/settings
                                        </a>
                                    ) : (
                                        <span className="italic">
                                            (enter Canvas Instance URL above)
                                            /profile/settings
                                        </span>
                                    )}{' '}
                                    while logged in as an admin.
                                </li>
                                <li>
                                    Scroll to <strong>Approved Integrations</strong>{' '}
                                    and click <strong>+ New Access Token</strong>.
                                </li>
                                <li>
                                    Give it a purpose (e.g. &quot;UnlockEd&quot;),
                                    leave the expiry blank, then click{' '}
                                    <strong>Generate Token</strong>.
                                </li>
                                <li>
                                    Copy the generated token and paste it above.
                                </li>
                            </ol>
                        </div>
                    )}
                </div>
                {isCanvas && (
                    <EnrollmentTypeSelector
                        selected={enrollmentTypes}
                        onChange={setEnrollmentTypes}
                    />
                )}
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
