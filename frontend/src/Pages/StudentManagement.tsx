import {
    ForwardedRef,
    startTransition,
    useEffect,
    useRef,
    useState
} from 'react';
import useSWR from 'swr';

import {
    ArrowPathRoundedSquareIcon,
    TrashIcon,
    PencilSquareIcon,
    PlusCircleIcon
} from '@heroicons/react/24/outline';
import {
    FilterResidentNames,
    ResetPasswordResponse,
    ServerResponseMany,
    ServerResponseOne,
    ToastState,
    User,
    UserRole
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import Pagination from '@/Components/Pagination';
import API from '@/api/api';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { useToast } from '@/Context/ToastCtx';
import {
    AddUserModal,
    closeModal,
    CRUDActions,
    EditUserModal,
    showModal,
    TargetItem,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useNavigate } from 'react-router-dom';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function StudentManagement() {
    const addUserModal = useRef<HTMLDialogElement>(null);
    const editUserModal = useRef<HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<HTMLDialogElement>(null);
    const deleteUserModal = useRef<HTMLDialogElement>(null);
    const [targetUser, setTargetUser] = useState<TargetItem<User> | null>(null);
    const [tempPassword, setTempPassword] = useState<string>('');
    const showUserPassword = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState(
        FilterResidentNames['Resident Name (A-Z)']
    );
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        Error
    >(
        `/api/users?search=${searchTerm}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=student`
    );
    const handleSearchTermChange = (newTerm: string) => {
        startTransition(() => {
            setSearchTerm(encodeURIComponent(newTerm));
        });
    };
    const checkResponseForDelete = useCheckResponse({
        mutate: mutate,
        refModal: deleteUserModal
    });
    const userData = data?.data as User[] | [];
    const meta = data?.meta;

    useEffect(() => {
        const ref =
            targetUser?.action === CRUDActions.Add
                ? addUserModal
                : targetUser?.action === CRUDActions.Edit
                  ? editUserModal
                  : targetUser?.action === CRUDActions.Delete
                    ? deleteUserModal
                    : targetUser?.action === CRUDActions.Reset
                      ? resetUserPasswordModal
                      : null;
        if (ref) {
            showModal(ref);
        }
    }, [targetUser]);

    const deleteUser = async () => {
        if (targetUser?.target.role === UserRole.SystemAdmin) {
            toaster(
                'This is the primary administrator and cannot be deleted',
                ToastState.error
            );
            return;
        }
        const response = await API.delete('users/' + targetUser?.target.id);
        checkResponseForDelete(
            response.success,
            'Failed to delete user',
            'User deleted successfully'
        );
        handleCancelModal(deleteUserModal);
    };

    const getTempPassword = async () => {
        if (targetUser === null) return;
        const response = (await API.post<
            ResetPasswordResponse,
            { user_id: number }
        >('users/student-password', {
            user_id: targetUser.target.id
        })) as ServerResponseOne<ResetPasswordResponse>;
        if (!response.success) {
            toaster('Failed to reset password', ToastState.error);
            return;
        }
        setTempPassword(response.data.temp_password);
        closeModal(resetUserPasswordModal);
        showModal(showUserPassword);
        toaster('Password reset successfully', ToastState.success);
        return;
    };

    const onAddUserSuccess = (pswd: string) => {
        setTempPassword(pswd);
        showModal(showUserPassword);
    };

    function handleCancelModal(ref: ForwardedRef<HTMLDialogElement>) {
        closeModal(ref);
        setTargetUser(null);
        setTempPassword('');
    }

    const handleShowUserProfileClick = (id: number) => {
        navigate(`/residents/${id}`);
    };

    return (
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4 px-5">
                <div className="flex justify-between">
                    <div className="flex flex-row gap-x-2">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={(newSearch) => {
                                handleSearchTermChange(newSearch);
                                setPageQuery(1);
                            }}
                        />
                        <DropdownControl
                            setState={setSortQuery}
                            enumType={{
                                ...FilterResidentNames,
                                'Account Created (Newest) ': 'created_at desc',
                                'Account Created  (Oldest)': 'created_at asc'
                            }}
                        />
                    </div>

                    <div
                        className="tooltip tooltip-left"
                        data-tip="Add Resident"
                    >
                        <button
                            className="button "
                            onClick={() => showModal(addUserModal)}
                        >
                            <PlusCircleIcon className="w-4 my-auto" />
                            Add Resident
                        </button>
                    </div>
                </div>
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-4">
                        <thead>
                            <tr className="grid grid-cols-6 px-4">
                                <th className="justify-self-start">Name</th>
                                <th>Username</th>
                                <th>DOC ID</th>
                                <th>Last Updated</th>
                                <th>Created At</th>
                                <th className="justify-self-end pr-4">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading &&
                                !error &&
                                userData.map((user: User) => {
                                    const updatedAt = new Date(user.updated_at);
                                    const createdAt = new Date(user.created_at);
                                    return (
                                        <tr
                                            key={user.id}
                                            className="card p-4 w-full grid-cols-6 justify-items-center cursor-pointer"
                                            onClick={() =>
                                                handleShowUserProfileClick(
                                                    user.id
                                                )
                                            }
                                        >
                                            <td className="justify-self-start">
                                                {user.name_last}
                                                {', '}
                                                {user.name_first}
                                            </td>
                                            <td>{user.username}</td>
                                            <td>{user.doc_id}</td>
                                            <td>
                                                <div
                                                    className="tooltip"
                                                    data-tip="User Activity"
                                                >
                                                    <a className="flex justify-start cursor-pointer">
                                                        <span>
                                                            {updatedAt.toLocaleDateString(
                                                                'en-US',
                                                                {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }
                                                            )}
                                                        </span>
                                                    </a>
                                                </div>
                                            </td>
                                            <td>
                                                <div
                                                    className="tooltip"
                                                    data-tip="Account Creation"
                                                >
                                                    <a className="flex justify-start cursor-pointer">
                                                        <span>
                                                            {createdAt.toLocaleDateString(
                                                                'en-US',
                                                                {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }
                                                            )}
                                                        </span>
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="justify-self-end">
                                                <div className="flex space-x-4">
                                                    <ULIComponent
                                                        dataTip={
                                                            'Edit Resident'
                                                        }
                                                        tooltipClassName="tooltip-left cursor-pointer"
                                                        icon={PencilSquareIcon}
                                                        onClick={(e) => {
                                                            e?.stopPropagation();
                                                            setTargetUser({
                                                                action: CRUDActions.Edit,
                                                                target: user
                                                            });
                                                            showModal(
                                                                editUserModal
                                                            );
                                                        }}
                                                    />

                                                    <ULIComponent
                                                        dataTip={
                                                            'Reset Password'
                                                        }
                                                        tooltipClassName="tooltip-left cursor-pointer"
                                                        icon={
                                                            ArrowPathRoundedSquareIcon
                                                        }
                                                        onClick={(e) => {
                                                            e?.stopPropagation();
                                                            setTargetUser({
                                                                action: CRUDActions.Reset,
                                                                target: user
                                                            });
                                                            showModal(
                                                                resetUserPasswordModal
                                                            );
                                                        }}
                                                    />

                                                    <ULIComponent
                                                        dataTip={
                                                            'Delete Resident'
                                                        }
                                                        tooltipClassName="tooltip-left cursor-pointer"
                                                        icon={TrashIcon}
                                                        onClick={(e) => {
                                                            e?.stopPropagation();
                                                            setTargetUser({
                                                                action: CRUDActions.Delete,
                                                                target: user
                                                            });
                                                            showModal(
                                                                deleteUserModal
                                                            );
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                    <div className="flex justify-center pt-20">
                        {!isLoading &&
                            !error &&
                            meta &&
                            userData.length > 0 && (
                                <Pagination
                                    meta={meta}
                                    setPage={setPageQuery}
                                    setPerPage={setPerPage}
                                />
                            )}
                    </div>
                    {error && (
                        <span className="text-center text-error">
                            Failed to load users.
                        </span>
                    )}
                    {!isLoading && !error && userData.length === 0 && (
                        <span className="text-center text-warning">
                            No results
                        </span>
                    )}
                </div>
            </div>
            <AddUserModal
                mutate={mutate}
                onSuccess={onAddUserSuccess}
                userRole={UserRole.Student}
                ref={addUserModal}
            />
            <EditUserModal
                mutate={mutate}
                ref={editUserModal}
                target={targetUser?.target}
            />
            <TextOnlyModal
                ref={deleteUserModal}
                type={TextModalType.Delete}
                title={'Delete Resident'}
                text={
                    'Are you sure you would like to delete this resident? This action cannot be undone.'
                }
                onSubmit={() => void deleteUser()}
                onClose={() => void handleCancelModal(deleteUserModal)}
            />
            <TextOnlyModal
                ref={resetUserPasswordModal}
                type={TextModalType.Confirm}
                title={'Reset Password'}
                text={`Are you sure you would like to reset ${targetUser?.target.name_first + ' ' + targetUser?.target.name_last}'s password?`}
                onSubmit={() => void getTempPassword()}
                onClose={() => void handleCancelModal(resetUserPasswordModal)}
            />
            <TextOnlyModal
                ref={showUserPassword}
                type={TextModalType.Information}
                title={'New Password'}
                text={` Copy the password below and share it with the resident.
                        If it's lost, you’ll need to reset it again.`}
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => handleCancelModal(showUserPassword)}
            >
                <div className="stats shadow mx-auto">
                    <div className="stat">
                        <div className="stat-title">Temporary Password</div>
                        <div className="stat-value">{tempPassword}</div>
                    </div>
                </div>
            </TextOnlyModal>
        </div>
    );
}
