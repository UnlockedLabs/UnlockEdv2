import { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { useParams } from 'react-router-dom';
import {
    ServerResponse,
    PaginationMeta,
    ProviderPlatform,
    ProviderUser,
    UserImports,
    ToastState,
    ModalType
} from '../common';
import Toast from '../Components/Toast';
import Modal from '../Components/Modal';
import MapUserForm from '@/Components/forms/MapUserForm';
import PrimaryButton from '@/Components/PrimaryButton';
import ShowImportedUsers from '@/Components/forms/ShowImportedUsers';
import Pagination from '@/Components/Pagination';
import useSWR from 'swr';
import ConfirmImportAllUsersForm from '@/Components/forms/ConfirmImportAllUsersForm';
import { useDebounceValue } from 'usehooks-ts';
import SearchBar from '@/Components/inputs/SearchBar';
import API from '@/api/api';

export default function ProviderUserManagement() {
    const mapUserModal = useRef<null | HTMLDialogElement>(null);
    const importedUsersModal = useRef<null | HTMLDialogElement>(null);
    const importAllUsersModal = useRef<null | HTMLDialogElement>(null);
    const [displayToast, setDisplayToast] = useState(false);
    const [usersToImport, setUsersToImport] = useState<ProviderUser[]>([]);
    const [userToMap, setUserToMap] = useState<null | ProviderUser>(undefined);
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const { providerId } = useParams();
    const [meta, setMeta] = useState<PaginationMeta>({
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 0
    });
    const [search, setSearch] = useState('');
    const searchQuery = useDebounceValue(search, 400);
    const [provider, setProvider] = useState<ProviderPlatform | null>(
        undefined
    );
    const [importedUsers, setImportedUsers] = useState<UserImports[]>([]);
    const [cache, setCache] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    const [toast, setToast] = useState({
        state: ToastState.null,
        message: '',
        reset: () => {}
    });

    const { data, mutate } = useSWR<ServerResponse<ProviderUser>>(
        `/api/actions/provider-platforms/${providerId}/get-users?page=${currentPage}&per_page=${perPage}&search=${searchQuery[0]}&clear_cache=${cache}`
    );
    const providerData = (data?.data as ProviderUser[]) ?? [];

    const changePage = (page: number) => {
        setCurrentPage(page);
    };

    const handleChangeUsersPerPage = (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        setPerPage(parseInt(e.target.value));
        setCurrentPage(1); // Reset to the first page when changing per page
    };

    const handleRefetch = () => {
        setError(false);
        setCache(true);
        mutate();
    };

    const showToast = (message: string, state: ToastState) => {
        setToast({
            state,
            message,
            reset: () => {
                setToast({
                    state: ToastState.success,
                    message: '',
                    reset: () => {
                        setDisplayToast(false);
                    }
                });
            }
        });
        setDisplayToast(true);
    };

    async function handleImportAllUsers() {
        const res = await API.post(
            `actions/provider-platforms/${providerId}/import-users`,
            {}
        );
        if (res.success) {
            showToast(
                'Users imported successfully, please check for accounts not created',
                ToastState.success
            );
            window.location.reload();
        } else {
            showToast(
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
            showToast(res.message, ToastState.success);
            console.log(res.data);
            setImportedUsers(res.data as UserImports[]);
            importedUsersModal.current?.showModal();
            setUsersToImport([]);
            mutate();
            return;
        } else {
            setUsersToImport([]);
            showToast(
                'error importing users, please check accounts',
                ToastState.error
            );
        }
    }

    function handleSubmitMapUser(msg: string, toastState: ToastState) {
        showToast(msg, toastState);
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

    async function handleMapUser(user: ProviderUser) {
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

    const handleChange = (newSearch: string) => {
        setSearch(newSearch);
        setCurrentPage(1);
    };

    useEffect(() => {
        if (data) {
            setMeta(data.meta as PaginationMeta);
            setCache(false);
        }
    }, [data]);

    useEffect(() => {
        const getData = async () => {
            const res = await API.get<ProviderPlatform>(
                `provider-platforms/${providerId}`
            );
            if (res.success) {
                setProvider(res.data as ProviderPlatform);
                setIsLoading(false);
            } else {
                showToast('Failed to fetch provider users', ToastState.error);
            }
        };
        getData();
    }, [providerId]);

    return (
        <AuthenticatedLayout
            title="Users"
            path={[
                'Provider Platforms',
                `Provider User Management${provider ? ' (' + provider.name + ')' : ''}`
            ]}
        >
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
                <div className="flex justify-between">
                    <SearchBar
                        searchTerm={searchQuery[0]}
                        changeCallback={handleChange}
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
                        onClick={() => handleImportSelectedUsers()}
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
                        meta={!isLoading && meta}
                        setPage={changePage}
                    />
                    <div className="flex-col-1 align-middle">
                        per page:
                        <br />
                        {!isLoading && providerData && (
                            <select
                                className="select select-none select-sm select-bordered"
                                value={perPage}
                                onChange={handleChangeUsersPerPage}
                            >
                                {[10, 15, 20, 30, 50].map((value) => (
                                    <option key={value} value={value}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
                {error && (
                    <span className="text-center text-error">
                        Failed to load users.
                    </span>
                )}
                {!isLoading &&
                    !error &&
                    data &&
                    (data.meta as PaginationMeta).total === 0 && (
                        <span className="text-center text-warning">
                            No results
                        </span>
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
                            providerId={parseInt(providerId)}
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
                        onSuccess={handleImportAllUsers}
                    />
                }
            />
            {displayToast && <Toast {...toast} />}
        </AuthenticatedLayout>
    );
}
