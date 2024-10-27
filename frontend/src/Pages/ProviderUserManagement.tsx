import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    ModalType,
    PaginationMeta,
    ProviderPlatform,
    ProviderPlatformType,
    ProviderUser,
    ServerResponseMany,
    ToastState,
    UserImports
} from '@/common';
import Modal from '@/Components/Modal';
import MapUserForm from '@/Components/forms/MapUserForm';
import PrimaryButton from '@/Components/PrimaryButton';
import ShowImportedUsers from '@/Components/forms/ShowImportedUsers';
import Pagination from '@/Components/Pagination';
import useSWR from 'swr';
import ConfirmImportAllUsersForm from '@/Components/forms/ConfirmImportAllUsersForm';
import { useDebounceValue } from 'usehooks-ts';
import SearchBar from '@/Components/inputs/SearchBar';
import API from '@/api/api';
import { AxiosError } from 'axios';
import { usePathValue } from '@/Context/PathValueCtx';
import { useToast } from '@/Context/ToastCtx';

export default function ProviderUserManagement() {
    const mapUserModal = useRef<HTMLDialogElement>(null);
    const importedUsersModal = useRef<HTMLDialogElement>(null);
    const importAllUsersModal = useRef<HTMLDialogElement>(null);
    const [usersToImport, setUsersToImport] = useState<ProviderUser[]>([]);
    const [userToMap, setUserToMap] = useState<undefined | ProviderUser>();
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const { id: providerId } = useParams();
    const { setPathVal } = usePathValue();
    const providerID = parseInt(providerId ?? '0', 10);
    const [meta, setMeta] = useState<PaginationMeta>({
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 0
    });
    const [search, setSearch] = useState('');
    const searchQuery = useDebounceValue(search, 400);
    const [provider, setProvider] = useState<ProviderPlatform | undefined>();
    const [importedUsers, setImportedUsers] = useState<UserImports[]>([]);
    const [cache, setCache] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const { toaster } = useToast();
    const { data, mutate } = useSWR<
        ServerResponseMany<ProviderUser>,
        AxiosError
    >(
        `/api/actions/provider-platforms/${providerId}/get-users?page=${currentPage}&per_page=${perPage}&search=${searchQuery[0]}&clear_cache=${cache}`
    );
    const providerData = data?.data ?? [];
    const changePage = (page: number) => {
        setCurrentPage(page);
        handleRefetch();
    };

    const handleRefetch = () => {
        setError(false);
        setCache(true);
        void mutate();
    };

    async function handleImportAllUsers() {
        const res = await API.post(
            `actions/provider-platforms/${providerId}/import-users`,
            {}
        );
        if (res.success) {
            toaster(
                'Users imported successfully, please check for accounts not created',
                ToastState.success
            );
            window.location.reload();
        } else {
            toaster(
                'error importing users, please check accounts',
                ToastState.error
            );
        }
    }

    async function handleImportSelectedUsers() {
        const res = await API.post<UserImports>(
            `provider-platforms/${providerId}/users/import`,
            { users: usersToImport }
        );
        if (res.success) {
            toaster(res.message, ToastState.success);
            setImportedUsers(res.data as UserImports[]);
            importedUsersModal.current?.showModal();
            setUsersToImport([]);
            await mutate();
            return;
        } else {
            setUsersToImport([]);
            toaster(
                'error importing users, please check accounts',
                ToastState.error
            );
        }
    }

    function handleSubmitMapUser(msg: string, toastState: ToastState) {
        toaster(msg, toastState);
        mapUserModal.current?.close();
    }

    function handleCloseImportedUsers() {
        importedUsersModal.current?.close();
        setImportedUsers([]);
        return;
    }

    function handleCloseMapUser() {
        mapUserModal.current?.close();
        setUserToMap(undefined);
    }

    function handleMapUser(user: ProviderUser) {
        setUserToMap(user);
        mapUserModal.current?.showModal();
    }

    function handleAddImportUser(user: ProviderUser) {
        if (usersToImport.includes(user)) {
            setUsersToImport(usersToImport.filter((u) => u !== user));
        } else {
            setUsersToImport([...usersToImport, user]);
        }
    }

    const handleChangeSearch = (newSearch: string) => {
        setSearch(newSearch);
        setCurrentPage(1);
    };
    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setCurrentPage(1);
        handleRefetch();
    };

    useEffect(() => {
        if (data) {
            setMeta(data.meta);
            setCache(false);
        }
    }, [data]);

    useEffect(() => {
        const getData = async () => {
            const res = await API.get<ProviderPlatform>(
                `provider-platforms/${providerId}`
            );
            if (res.success) {
                const prov = res.data as ProviderPlatform;
                setProvider(prov);
                setPathVal([
                    { path_id: ':provider_platform_name', value: prov.name }
                ]);
                setIsLoading(false);
            } else {
                toaster('Failed to fetch provider users', ToastState.error);
            }
        };
        void getData();
    }, [providerId]);

    if (provider && provider.type === ProviderPlatformType.KOLIBRI) {
        return <div>Kolibri users are managed automatically</div>;
    }
    return (
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
                <div className="flex justify-between">
                    <SearchBar
                        searchTerm={searchQuery[0]}
                        changeCallback={handleChangeSearch}
                    />
                </div>
                <div className="flex justify-between">
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={handleRefetch}
                    >
                        Refresh
                    </button>
                    <PrimaryButton
                        onClick={() => importAllUsersModal.current?.showModal()}
                        disabled={!provider}
                    >
                        Import All Users
                    </PrimaryButton>
                    <PrimaryButton
                        onClick={() => {
                            void handleImportSelectedUsers();
                        }}
                        disabled={usersToImport.length === 0}
                    >
                        Import Selected Users
                    </PrimaryButton>
                </div>
                <div className="overflow-x-auto">
                    <table className="table table-auto table-xs w-full">
                        <thead>
                            <tr className="border-gray-600 table-row">
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Import</th>
                                <th>Associate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading &&
                                !error &&
                                providerData.map((user: ProviderUser) => (
                                    <tr
                                        key={user.external_user_id}
                                        className="border-gray-600 table-row"
                                    >
                                        <td>
                                            {user.name_first +
                                                ' ' +
                                                user.name_last}
                                        </td>
                                        <td>{user.username}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <div
                                                className="tooltip"
                                                data-tip="import user into platform"
                                            >
                                                <div className="form-control">
                                                    <label className="label cursor-pointer gap-2">
                                                        Import User
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox"
                                                            onChange={() =>
                                                                handleAddImportUser(
                                                                    user
                                                                )
                                                            }
                                                            checked={usersToImport.includes(
                                                                user
                                                            )}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div
                                                className="tooltip"
                                                data-tip="Associate user with existing account"
                                            >
                                                <button
                                                    onClick={() =>
                                                        handleMapUser(user)
                                                    }
                                                    className="btn btn-xs btn-primary"
                                                >
                                                    Map User
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-col justify-center">
                    <Pagination
                        meta={meta}
                        setPage={changePage}
                        setPerPage={handleSetPerPage}
                    />
                </div>
                {error && (
                    <span className="text-center text-error">
                        Failed to load users.
                    </span>
                )}
                {!isLoading && !error && data && data.meta.total === 0 && (
                    <span className="text-center text-warning">No results</span>
                )}
            </div>
            {provider && (
                <Modal
                    ref={mapUserModal}
                    type={ModalType.Associate}
                    item="User"
                    form={
                        <MapUserForm
                            onSubmit={handleSubmitMapUser}
                            externalUser={userToMap}
                            onCancel={handleCloseMapUser}
                            providerId={providerID}
                        />
                    }
                />
            )}
            <Modal
                ref={importedUsersModal}
                type={ModalType.Show}
                item="Imported Users"
                form={
                    <ShowImportedUsers
                        users={importedUsers}
                        onExit={handleCloseImportedUsers}
                    />
                }
            />
            <Modal
                ref={importAllUsersModal}
                type={ModalType.Confirm}
                item="Import All Users"
                form={
                    <ConfirmImportAllUsersForm
                        onCancel={() => importAllUsersModal.current?.close()}
                        onSuccess={() => {
                            void handleImportAllUsers();
                        }}
                    />
                }
            />
        </div>
    );
}
