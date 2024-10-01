import { useRef, useState } from 'react';
import useSWR from 'swr';

import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import {
    ArrowPathRoundedSquareIcon,
    PencilIcon,
    TrashIcon,
    PlusIcon
} from '@heroicons/react/20/solid';
import { DEFAULT_ADMIN_ID, ServerResponse, User } from '../common';
import AddUserForm from '../Components/forms/AddUserForm';
import EditUserForm from '../Components/forms/EditUserForm';
import Toast, { ToastState } from '../Components/Toast';
import Modal, { ModalType } from '../Components/Modal';
import DeleteForm from '../Components/DeleteForm';
import ResetPasswordForm from '../Components/forms/ResetPasswordForm';
import ShowTempPasswordForm from '../Components/forms/ShowTempPasswordForm';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '../Components/inputs/SearchBar';
import { useDebounceValue } from 'usehooks-ts';
import Pagination from '@/Components/Pagination';
import API from '@/api/api';

export default function AdminManagement() {
    const addUserModal = useRef<null | HTMLDialogElement>(null);
    const editUserModal = useRef<null | HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<null | HTMLDialogElement>(null);
    const deleteUserModal = useRef<null | HTMLDialogElement>(null);
    const [displayToast, setDisplayToast] = useState(false);
    const [targetUser, setTargetUser] = useState<null | User>(null);
    const [tempPassword, setTempPassword] = useState<string>('');
    const showUserPassword = useRef<null | HTMLDialogElement>(null);
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
            setTargetUser(null);
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
            : response.statusText;
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
                <h1>Admin Management</h1>
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
                            className="btn btn-primary btn-sm text-white" // Makes the text white
                            onClick={() => addUserModal.current?.showModal()}
                        >
                            <PlusIcon className="h-4 border border-white rounded-full p-1 mr-2" />{' '}
                            {/* Circular border around PlusIcon */}
                            Add Admin
                        </button>
                    </div>
                </div>
                <div className="w-full space-y-4">
                    <div className="relative">
                        <div className="grid grid-cols-4 px-6 mb-2 text-sm font-medium text-gray-500">
                            <div>Name</div>
                            <div>Username</div>
                            <div>Last Active</div>
                            <div>Actions</div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-black"></div>
                    </div>

                    {!isLoading &&
                        !error &&
                        userData.map((user) => {
                            const updatedAt = new Date(user.updated_at);
                            return (
                                <div
                                    key={user.id}
                                    className="grid grid-cols-4 items-center px-6 py-4 bg-white rounded-lg shadow-sm border border-gray-200"
                                >
                                    <div className="text-sm text-gray-900">
                                        {user.name_first} {user.name_last}
                                    </div>
                                    <div className="text-sm text-gray-900">
                                        {user.username}
                                    </div>
                                    <div>
                                        <div
                                            className="tooltip"
                                            data-tip="Activity"
                                        >
                                            <span className="text-sm text-gray-900 cursor-pointer">
                                                {updatedAt.toLocaleDateString(
                                                    'en-US',
                                                    {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    }
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-4 text-accent">
                                        <div
                                            className="tooltip"
                                            data-tip="Edit Admin"
                                        >
                                            <PencilIcon
                                                className="h-4 w-4 cursor-pointer"
                                                onClick={() => {
                                                    setTargetUser(user);
                                                    editUserModal.current?.showModal();
                                                }}
                                            />
                                        </div>
                                        <div
                                            className="tooltip"
                                            data-tip="Reset Password"
                                        >
                                            <ArrowPathRoundedSquareIcon
                                                className="h-4 w-4 cursor-pointer"
                                                onClick={() => {
                                                    setTargetUser(user);
                                                    resetUserPasswordModal.current?.showModal();
                                                }}
                                            />
                                        </div>
                                        <div
                                            className="tooltip"
                                            data-tip="Delete Admin"
                                        >
                                            {user.id !== DEFAULT_ADMIN_ID && (
                                                <TrashIcon
                                                    className="h-4 w-4 cursor-pointer"
                                                    onClick={() => {
                                                        setTargetUser(user);
                                                        deleteUserModal.current?.showModal();
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
                {!isLoading && !error && userData.length != 0 && (
                    <Pagination meta={data.meta} setPage={setPageQuery} />
                )}
                {error && (
                    <span className="text-center text-error">
                        Failed to load users.
                    </span>
                )}
                {!isLoading && !error && userData.length == 0 && (
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
                                : null
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
