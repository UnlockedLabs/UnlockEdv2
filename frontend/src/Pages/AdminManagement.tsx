import { useRef, useState } from 'react';
import useSWR from 'swr';

import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import {
    ArrowPathRoundedSquareIcon,
    TrashIcon,
    PlusCircleIcon,
    PencilSquareIcon
} from '@heroicons/react/24/outline';

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
                <h1 className="text-header-text">Admin Management</h1>
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
                            className="btn btn-primary btn-sm text-base-teal"
                            onClick={() => addUserModal.current?.showModal()}
                        >
                            <PlusCircleIcon className="w-4 my-auto" />
                            Add Admin
                        </button>
                    </div>
                </div>
                <table className="table-2">
                    <thead>
                        <tr className="grid-cols-4 px-4">
                            <th className="justify-self-start">Name</th>
                            <th>Username</th>
                            <th>Last Active</th>
                            <th className="justify-self-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading &&
                            !error &&
                            userData.map((user) => {
                                const updatedAt = new Date(user.updated_at);
                                return (
                                    <tr
                                        key={user.id}
                                        className="card p-4 w-full grid-cols-4 justify-items-center"
                                    >
                                        <td className="justify-self-start">
                                            {user.name_first} {user.name_last}
                                        </td>
                                        <td className={''}>{user.username}</td>
                                        <td>
                                            <div
                                                className="tooltip"
                                                data-tip="Activity"
                                            >
                                                <span className="cursor-pointer">
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
                                        </td>
                                        <td className="justify-self-end">
                                            <div className="flex space-x-4">
                                                <div
                                                    className="tooltip"
                                                    data-tip="Edit Admin"
                                                >
                                                    <PencilSquareIcon
                                                        className="h-5 w-5 text-grey-3 hover:text-primary cursor-pointer"
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
                                                        className="h-5 w-5 text-grey-3 hover:text-primary cursor-pointer"
                                                        onClick={() => {
                                                            setTargetUser(user);
                                                            resetUserPasswordModal.current?.showModal();
                                                        }}
                                                    />
                                                </div>
                                                {user.id !==
                                                    DEFAULT_ADMIN_ID && (
                                                    <div
                                                        className="tooltip"
                                                        data-tip="Delete Admin"
                                                    >
                                                        <TrashIcon
                                                            className="h-5 w-5 text-grey-3 hover:text-error cursor-pointer"
                                                            onClick={() => {
                                                                setTargetUser(
                                                                    user
                                                                );
                                                                deleteUserModal.current?.showModal();
                                                            }}
                                                        />
                                                    </div>
                                                )}
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

            {/* Modals */}
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
            {/*Toast*/}
            {displayToast && <Toast {...toast} />}
        </AuthenticatedLayout>
    );
}
