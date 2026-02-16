import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
    ProviderPlatform,
    ProviderPlatformType,
    ProviderUser,
    User,
    UserImports,
    ServerResponseMany,
    PaginationMeta
} from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useDebounceValue } from 'usehooks-ts';

export default function ProviderUserManagement() {
    const { id: providerId } = useParams();

    const [usersToImport, setUsersToImport] = useState<ProviderUser[]>([]);
    const [userToMap, setUserToMap] = useState<ProviderUser | undefined>();
    const [perPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounceValue(search, 400);
    const [provider, setProvider] = useState<ProviderPlatform | undefined>();
    const [importedUsers, setImportedUsers] = useState<UserImports[]>([]);
    const [cache, setCache] = useState(false);
    const [providerLoading, setProviderLoading] = useState(true);
    const [showMapModal, setShowMapModal] = useState(false);
    const [showImportedModal, setShowImportedModal] = useState(false);
    const [showImportAllConfirm, setShowImportAllConfirm] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [mapSearch, setMapSearch] = useState('');
    const [mapSubmitting, setMapSubmitting] = useState(false);

    const [meta, setMeta] = useState<PaginationMeta>({
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 0
    });

    const { data, mutate } = useSWR<ServerResponseMany<ProviderUser>>(
        `/api/actions/provider-platforms/${providerId}/get-users?page=${currentPage}&per_page=${perPage}&search=${debouncedSearch}&clear_cache=${cache}`
    );

    const { data: unmappedResp, mutate: mutateUnmapped } = useSWR<ServerResponseMany<User>>(
        showMapModal
            ? `/api/users?include=only_unmapped&provider_id=${providerId}&per_page=50`
            : null
    );
    const unmappedUsers = unmappedResp?.data ?? [];

    const filteredUnmapped = mapSearch
        ? unmappedUsers.filter(
              (u) =>
                  u.username.toLowerCase().includes(mapSearch.toLowerCase()) ||
                  `${u.name_first} ${u.name_last}`.toLowerCase().includes(mapSearch.toLowerCase())
          )
        : unmappedUsers;

    const providerUsers = data?.data ?? [];

    useEffect(() => {
        if (data) {
            setMeta(data.meta);
            setCache(false);
        }
    }, [data]);

    useEffect(() => {
        const fetchProvider = async () => {
            const res = await API.get<ProviderPlatform>(
                `provider-platforms/${providerId}`
            );
            if (res.success) {
                setProvider(res.data as ProviderPlatform);
            } else {
                toast.error('Failed to fetch provider details.');
            }
            setProviderLoading(false);
        };
        void fetchProvider();
    }, [providerId]);

    const handleRefresh = () => {
        setCache(true);
        void mutate();
    };

    const handleSearchChange = (val: string) => {
        setSearch(val);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const toggleImportUser = (user: ProviderUser) => {
        setUsersToImport((prev) =>
            prev.includes(user)
                ? prev.filter((u) => u !== user)
                : [...prev, user]
        );
    };

    const handleImportAll = async () => {
        const res = await API.post(
            `actions/provider-platforms/${providerId}/import-users`,
            {}
        );
        if (res.success) {
            toast.success(
                'Users imported successfully. Please check for accounts not created.'
            );
            window.location.reload();
        } else {
            toast.error('Error importing users.');
        }
        setShowImportAllConfirm(false);
    };

    const handleImportSelected = async () => {
        const res = await API.post<UserImports, { users: ProviderUser[] }>(
            `provider-platforms/${providerId}/users/import`,
            { users: usersToImport }
        );
        if (res.success) {
            toast.success('Users imported successfully.');
            setImportedUsers(res.data as UserImports[]);
            setShowImportedModal(true);
            setUsersToImport([]);
            await mutate();
        } else {
            setUsersToImport([]);
            toast.error('Error importing users.');
        }
    };

    const handleMapUser = async () => {
        if (!userToMap || selectedUserId === null) return;
        setMapSubmitting(true);
        const res = await API.post(
            `provider-platforms/${providerId}/map-user/${selectedUserId}`,
            userToMap
        );
        setMapSubmitting(false);
        if (res.success) {
            toast.success('User mapped successfully.');
            setShowMapModal(false);
            setUserToMap(undefined);
            setSelectedUserId(null);
            setMapSearch('');
            void mutate();
            void mutateUnmapped();
        } else {
            toast.error('Failed to map user.');
        }
    };

    if (providerLoading) {
        return (
            <div className="bg-muted min-h-screen p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-96 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    if (provider?.type === ProviderPlatformType.KOLIBRI) {
        return (
            <div className="bg-muted min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <p className="text-muted-foreground">
                            Kolibri users are managed automatically.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const columns: Column<ProviderUser>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (user) => (
                <span className="font-medium text-foreground">
                    {user.name_last}, {user.name_first}
                </span>
            )
        },
        {
            key: 'username',
            header: 'Username',
            render: (user) => user.username
        },
        {
            key: 'email',
            header: 'Email',
            render: (user) => user.email
        },
        {
            key: 'import',
            header: 'Import',
            headerClassName: 'text-center',
            className: 'text-center',
            render: (user) => (
                <Checkbox
                    checked={usersToImport.includes(user)}
                    onCheckedChange={() => toggleImportUser(user)}
                />
            )
        },
        {
            key: 'map',
            header: 'Associate',
            headerClassName: 'text-center',
            className: 'text-center',
            render: (user) => (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                        e.stopPropagation();
                        setUserToMap(user);
                        setSelectedUserId(null);
                        setMapSearch('');
                        setShowMapModal(true);
                    }}
                    className="text-foreground border-border"
                >
                    Map User
                </Button>
            )
        }
    ];

    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title={provider?.name ?? 'Provider Users'}
                    subtitle="Manage and import users from the external platform"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <SearchInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search users..."
                        className="w-full sm:w-80"
                    />
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            className="text-foreground border-border"
                        >
                            <ArrowPathIcon className="size-4 mr-1" />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowImportAllConfirm(true)}
                            disabled={!provider}
                            className="text-foreground border-border"
                        >
                            Import All Users
                        </Button>
                        <Button
                            onClick={() => void handleImportSelected()}
                            disabled={usersToImport.length === 0}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Import Selected ({usersToImport.length})
                        </Button>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={providerUsers}
                    keyExtractor={(user) => user.external_user_id}
                    emptyMessage="No users found."
                    page={meta.current_page}
                    totalPages={meta.last_page}
                    onPageChange={handlePageChange}
                />

                <FormModal
                    open={showMapModal}
                    onOpenChange={setShowMapModal}
                    title="Map User"
                    description={`Associate ${userToMap ? `${userToMap.name_first} ${userToMap.name_last}` : ''} with an existing UnlockEd account.`}
                >
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={mapSearch}
                            onChange={(e) => setMapSearch(e.target.value)}
                            placeholder="Search by name or username..."
                            className="w-full rounded-md border border-border px-3 py-2 text-sm"
                        />
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            {filteredUnmapped.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-3 text-center">
                                    No unmapped users found.
                                </p>
                            ) : (
                                filteredUnmapped.map((u) => (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedUserId(u.id)}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm border-b last:border-b-0 ${
                                            selectedUserId === u.id
                                                ? 'bg-[#556830]/10'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        <div>
                                            <span className="font-medium text-foreground">
                                                {u.name_first} {u.name_last}
                                            </span>
                                            <span className="text-muted-foreground ml-2">
                                                ({u.username})
                                            </span>
                                        </div>
                                        {selectedUserId === u.id && (
                                            <span className="text-[#556830] font-medium text-xs">
                                                Selected
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowMapModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleMapUser()}
                                disabled={mapSubmitting || selectedUserId === null}
                                className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            >
                                {mapSubmitting ? 'Mapping...' : 'Map User'}
                            </Button>
                        </div>
                    </div>
                </FormModal>

                <FormModal
                    open={showImportedModal}
                    onOpenChange={setShowImportedModal}
                    title="Imported Users"
                    description="These accounts have been created. Please save the temporary passwords."
                >
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {importedUsers.map((u) => (
                            <div
                                key={u.username}
                                className="flex items-center justify-between rounded-md bg-muted p-3"
                            >
                                <span className="text-sm font-medium text-foreground">
                                    {u.username}
                                </span>
                                <div className="text-right">
                                    {u.error ? (
                                        <span className="text-xs text-red-600">
                                            {u.error}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-mono text-muted-foreground">
                                            {u.temp_password}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={() => {
                                setShowImportedModal(false);
                                setImportedUsers([]);
                            }}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Close
                        </Button>
                    </div>
                </FormModal>

                <ConfirmDialog
                    open={showImportAllConfirm}
                    onOpenChange={setShowImportAllConfirm}
                    title="Import All Users"
                    description="This will import all users from the provider platform. Are you sure you want to continue?"
                    confirmLabel="Import All"
                    onConfirm={() => void handleImportAll()}
                />
            </div>
        </div>
    );
}
