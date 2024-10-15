import { useRef, useState } from 'react';
import useSWR from 'swr';

import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import {
    ArrowPathRoundedSquareIcon,
    PencilIcon,
    TrashIcon,
    UserPlusIcon
} from '@heroicons/react/20/solid';
import {
    DEFAULT_ADMIN_ID,
    ModalType,
    PaginationMeta,
    ServerResponse,
    ToastState,
    User
} from '../common';
import AddUserForm from '../Components/forms/AddUserForm';
import EditUserForm from '../Components/forms/EditUserForm';
import Toast from '../Components/Toast';
import Modal from '../Components/Modal';
import DeleteForm from '../Components/DeleteForm';
import ResetPasswordForm from '../Components/forms/ResetPasswordForm';
import ShowTempPasswordForm from '../Components/forms/ShowTempPasswordForm';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '../Components/inputs/SearchBar';
import { useDebounceValue } from 'usehooks-ts';
import Pagination from '@/Components/Pagination';
import API from '@/api/api';
import ULIComponent from '@/Components/ULIComponent.tsx';

export default function AdminManagement() {
    const addUserModal = useRef<undefined | HTMLDialogElement>();
    const editUserModal = useRef<undefined | HTMLDialogElement>();
    const resetUserPasswordModal = useRef<undefined | HTMLDialogElement>();
    const deleteUserModal = useRef<undefined | HTMLDialogElement>();
    const [displayToast, setDisplayToast] = useState(false);
    const [targetUser, setTargetUser] = useState<undefined | User>();
    const [tempPassword, setTempPassword] = useState<string>('');
    const showUserPassword = useRef<undefined | HTMLDialogElement>();
    const [toast, setToast] = useState({
        state: ToastState.null,
        message: '',
        reset: () => {}
    });

    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 300);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const { data, mutate, error, isLoading } = useSWR<ServerResponse<User>>(
        `/api/users?search=${searchQuery[0]}&page=${pageQuery}&order_by=${sortQuery}&role=admin`
    );
    const userData = data?.data as User[] | [];
    const meta = data?.meta as PaginationMeta;
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

    function resetModal() {
        setTimeout(() => {
            setTargetUser(undefined);
        }, 200);
    }

    const deleteUser = async () => {
        if (targetUser?.id === DEFAULT_ADMIN_ID) {
            showToast(
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
            ? 'User deleted successfully'
            : response.message;
        deleteUserModal.current?.close();
        showToast(message, toastType);
        resetModal();
        mutate();
        return;
    };

    const onAddUserSuccess = (pswd = '', msg: string, type: ToastState) => {
        showToast(msg, type);
        setTempPassword(pswd);
        addUserModal.current?.close();
        showUserPassword.current?.showModal();
        mutate();
    };

    const hanldleEditUser = () => {
        editUserModal.current?.close();
        resetModal();
        mutate();
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
        showToast(msg, state);
        resetModal();
    };

    const handleDisplayTempPassword = (psw: string) => {
        setTempPassword(psw);
        resetUserPasswordModal.current?.close();
        showUserPassword.current?.showModal();
        showToast('Password Successfully Reset', ToastState.success);
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

    return (
        <AuthenticatedLayout
            title="Admin Management"
            path={['Admin Management']}
        >
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
                <div className="pt-8">
                    <h1>Admin Management</h1>
                </div>
                <div className="flex justify-between">
                    <div className="flex flex-row gap-x-2">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={handleChange}
                        />
                        <DropdownControl
                            label="order by"
                            callback={setSortQuery}
                            enumType={{
                                'Name (A-Z)': 'name_last asc',
                                'Name (Z-A)': 'name_last desc',
                                'Account Created ↓ ': 'created_at desc',
                                'Account Created ↑ ': 'created_at asc'
                            }}
                        />
                    </div>

                    <div
                        className="tooltip tooltip-left"
                        data-tip="Add Administrator"
                    >
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => addUserModal.current?.showModal()}
                        >
                            <UserPlusIcon className="h-4" />
                        </button>
                    </div>
                </div>
                <table className="table">
                    <thead>
                        <tr className="border-gray-600">
                            <th className="flex">
                                <span>Name</span>
                            </th>
                            <th>Username</th>
                            <th>Last Updated</th>
                            <th>Actions</th>
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
                                        className="border-gray-600"
                                    >
                                        <td>
                                            {user.name_first} {user.name_last}
                                        </td>
                                        <td>{user.username}</td>
                                        <td>
                                            <div
                                                className="tooltip"
                                                data-tip="Activity"
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
                                            <div className="flex space-x-2 text-accent cursor-pointer">
                                                <ULIComponent
                                                    dataTip={'Edit Admin'}
                                                    onClick={() => {
                                                        setTargetUser(user);
                                                        editUserModal.current?.showModal();
                                                    }}
                                                    icon={PencilIcon}
                                                />
                                                <ULIComponent
                                                    dataTip={'Edit Admin'}
                                                    onClick={() => {
                                                        setTargetUser(user);
                                                        resetUserPasswordModal.current?.showModal();
                                                    }}
                                                    icon={
                                                        ArrowPathRoundedSquareIcon
                                                    }
                                                />
                                                <ULIComponent
                                                    dataTip={'Delete Admin'}
                                                    onClick={() => {
                                                        setTargetUser(user);
                                                        deleteUserModal.current?.showModal();
                                                    }}
                                                    icon={TrashIcon}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
                {!isLoading && !error && userData.length > 0 && (
                    <Pagination meta={meta} setPage={setPageQuery} />
                )}
                {error && (
                    <span className="text-center text-error">
                        Failed to load users.
                    </span>
                )}
                {!isLoading && !error && userData.length === 0 && (
                    <span className="text-center text-warning">No results</span>
                )}
            </div>

            <Modal
                ref={addUserModal}
                type={ModalType.Add}
                item="User"
                form={<AddUserForm onSuccess={onAddUserSuccess} />}
            />
            <Modal
                ref={editUserModal}
                type={ModalType.Edit}
                item="Admin"
                form={
                    targetUser ? (
                        <EditUserForm
                            onSuccess={hanldleEditUser}
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
                        onSuccess={deleteUser}
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
            {/* Toasts */}
            {displayToast && <Toast {...toast} />}
        </AuthenticatedLayout>
    );
}
