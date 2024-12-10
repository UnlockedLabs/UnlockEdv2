import { useRef, useState } from 'react';
import useSWR from 'swr';
import {
    ArrowPathRoundedSquareIcon,
    LockClosedIcon,
    TrashIcon,
    PencilIcon,
    PlusCircleIcon
} from '@heroicons/react/24/outline';
import {
    ModalType,
    ServerResponseMany,
    ToastState,
    User,
    UserRole
} from '@/common';
import AddUserForm from '@/Components/forms/AddUserForm';
import EditUserForm from '@/Components/forms/EditUserForm';
import Modal from '@/Components/Modal';
import DeleteForm from '@/Components/DeleteForm';
import ResetPasswordForm from '@/Components/forms/ResetPasswordForm';
import ShowTempPasswordForm from '@/Components/forms/ShowTempPasswordForm';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import { useDebounceValue } from 'usehooks-ts';
import Pagination from '@/Components/Pagination';
import { AxiosError } from 'axios';
import API from '@/api/api';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { useToast } from '@/Context/ToastCtx';

export default function AdminManagement() {
    const addUserModal = useRef<HTMLDialogElement>(null);
    const editUserModal = useRef<HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<HTMLDialogElement>(null);
    const deleteUserModal = useRef<HTMLDialogElement>(null);
    const [targetUser, setTargetUser] = useState<undefined | User>();
    const [tempPassword, setTempPassword] = useState<string>('');
    const showUserPassword = useRef<HTMLDialogElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 300);
    const [perPage, setPerPage] = useState(10);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const { toaster } = useToast();
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        AxiosError
    >(
        `/api/users?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=admin`
    );
    const userData = data?.data as User[] | [];
    const meta = data?.meta;

    function resetModal() {
        setTimeout(() => {
            setTargetUser(undefined);
        }, 200);
    }

    const deleteUser = async () => {
        if (targetUser?.role === UserRole.SystemAdmin) {
            toaster(
                'This is the primary administrator and cannot be deleted',
                ToastState.error
            );
            return;
        }
        const response = await API.delete('users/' + targetUser?.id);
        const toastType = response.success
            ? ToastState.success
            : ToastState.error;
        const message = response.success
            ? 'Administrator deleted successfully'
            : response.message;
        deleteUserModal.current?.close();
        toaster(message, toastType);
        resetModal();
        await mutate();
        return;
    };

    const onAddUserSuccess = (pswd = '', msg: string, type: ToastState) => {
        toaster(msg, type);
        setTempPassword(pswd);
        addUserModal.current?.close();
        showUserPassword.current?.showModal();
        void mutate();
    };

    const handleEditUser = () => {
        editUserModal.current?.close();
        resetModal();
        void mutate();
    };

    const handleDeleteUserCancel = () => {
        deleteUserModal.current?.close();
        resetModal();
    };

    const handleResetPasswordCancel = (msg: string, err: boolean) => {
        const state = err ? ToastState.error : ToastState.success;
        if (msg === '' && !err) {
            resetUserPasswordModal.current?.close();
            resetModal();
            return;
        }
        toaster(msg, state);
        resetModal();
    };

    const handleDisplayTempPassword = (psw: string) => {
        setTempPassword(psw);
        resetUserPasswordModal.current?.close();
        showUserPassword.current?.showModal();
        toaster('Password Successfully Reset', ToastState.success);
    };

    const handleShowPasswordClose = () => {
        showUserPassword.current?.close();
        setTempPassword('');
        resetModal();
    };

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };
    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };
    const getUserIconData = {
        'data-tip': (user: User) => {
            return user.role === UserRole.SystemAdmin
                ? 'Cannot Delete'
                : 'Delete Admin';
        },
        icon: (user: User) => {
            return user.role === UserRole.SystemAdmin
                ? LockClosedIcon
                : TrashIcon;
        },
        onClick: (user: User) => {
            return user.role === UserRole.SystemAdmin
                ? undefined
                : () => {
                      setTargetUser(user);
                      deleteUserModal.current?.showModal();
                  };
        }
    };

    return (
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4 px-8">
                <h1>Admins</h1>
                <div className="flex justify-between">
                    <div className="flex flex-row gap-x-2">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={handleChange}
                        />
                        <DropdownControl
                            label="order by"
                            setState={setSortQuery}
                            enumType={{
                                'Name (A-Z)': 'name_last asc',
                                'Name (Z-A)': 'name_last desc',
                                'Account Created &#8595; ': 'created_at desc',
                                'Account Created &#8593; ': 'created_at asc'
                            }}
                        />
                    </div>

                    <div className="tooltip tooltip-left" data-tip="Add Admin">
                        <button
                            className="btn btn-primary btn-sm text-base-teal"
                            onClick={() => addUserModal.current?.showModal()}
                        >
                            <PlusCircleIcon className="w-4 my-auto" />
                            Add Admin
                        </button>
                    </div>
                </div>
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-4">
                        <thead>
                            <tr className="grid-cols-4 px-4">
                                <th className="justify-self-start">Name</th>
                                <th>Username</th>
                                <th>Last Updated</th>
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
                                    return (
                                        <tr
                                            key={user.id}
                                            className="card p-4 w-full grid-cols-4 justify-items-center"
                                        >
                                            <td className="justify-self-start">
                                                {user.name_first}{' '}
                                                {user.name_last}
                                            </td>
                                            <td>{user.username}</td>
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
                                            <td className="justify-self-end">
                                                <div className="flex space-x-4">
                                                    <ULIComponent
                                                        dataTip={'Edit Admin'}
                                                        tooltipClassName="tooltip-left"
                                                        onClick={() => {
                                                            setTargetUser(user);
                                                            editUserModal.current?.showModal();
                                                        }}
                                                        icon={PencilIcon}
                                                    />
                                                    <ULIComponent
                                                        dataTip={
                                                            'Reset Password'
                                                        }
                                                        tooltipClassName="tooltip-left"
                                                        onClick={() => {
                                                            setTargetUser(user);
                                                            resetUserPasswordModal.current?.showModal();
                                                        }}
                                                        icon={
                                                            ArrowPathRoundedSquareIcon
                                                        }
                                                    />
                                                    <ULIComponent
                                                        dataTip={getUserIconData[
                                                            'data-tip'
                                                        ](user)}
                                                        tooltipClassName="tooltip-left"
                                                        onClick={getUserIconData.onClick(
                                                            user
                                                        )}
                                                        icon={getUserIconData.icon(
                                                            user
                                                        )}
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
                                    setPerPage={handleSetPerPage}
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
            <Modal
                ref={addUserModal}
                type={ModalType.Add}
                item="Admin"
                form={
                    <AddUserForm
                        onSuccess={onAddUserSuccess}
                        userRole={UserRole.Admin}
                    />
                }
            />
            <Modal
                ref={editUserModal}
                type={ModalType.Edit}
                item="Admin"
                form={
                    targetUser ? (
                        <EditUserForm
                            onSuccess={handleEditUser}
                            user={targetUser}
                        />
                    ) : (
                        <div>No user defined!</div>
                    )
                }
            />
            <Modal
                ref={deleteUserModal}
                type={ModalType.Confirm}
                item="Delete Admin"
                form={
                    <DeleteForm
                        item="User"
                        onCancel={handleDeleteUserCancel}
                        onSuccess={() => void deleteUser()}
                    />
                }
            />
            <Modal
                ref={resetUserPasswordModal}
                type={ModalType.Confirm}
                item="Reset Password"
                form={
                    <ResetPasswordForm
                        user={targetUser}
                        onCancel={handleResetPasswordCancel}
                        onSuccess={handleDisplayTempPassword}
                    />
                }
            />
            <Modal
                ref={showUserPassword}
                type={ModalType.Show}
                item={'New Password'}
                form={
                    <ShowTempPasswordForm
                        tempPassword={tempPassword}
                        userName={
                            targetUser
                                ? `${targetUser.name_first} ${targetUser.name_last}`
                                : undefined
                        }
                        onClose={handleShowPasswordClose}
                    />
                }
            />
        </div>
    );
}
