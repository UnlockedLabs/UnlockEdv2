import { useRef, useState } from "react";
import { useDebounce } from "usehooks-ts";
import useSWR from "swr";
import axios from "axios";

import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    ChevronDownIcon,
    ArrowPathRoundedSquareIcon,
    ArrowUpRightIcon,
    PencilIcon,
    TrashIcon,
    UserPlusIcon,
    ChevronUpIcon,
} from "@heroicons/react/24/solid";
import { PageProps } from "@/types";
import { User } from "@/common";
import PageNav from "@/Components/PageNav";
import Pagination, { PaginatedData } from "@/Components/Pagination";
import AddUserForm from "@/Components/forms/AddUserForm";
import EditUserForm from "@/Components/forms/EditUserForm";
import Toast, { ToastState } from "@/Components/Toast";
import Modal, { ModalType } from "@/Components/Modal";
import DeleteForm from "@/Components/DeleteForm";
import ResetPasswordForm from "@/Components/forms/ResetPasswordForm";
import ShowTempPasswordForm from "@/Components/forms/ShowTempPasswordForm";

export default function Users({ auth }: PageProps) {
    const addUserModal = useRef<null | HTMLDialogElement>(null);
    const editUserModal = useRef<null | HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<null | HTMLDialogElement>(null);
    const deleteUserModal = useRef<null | HTMLDialogElement>(null);
    const [displayToast, setDisplayToast] = useState(false);
    const [targetUser, setTargetUser] = useState<null | User>(null);
    const [tempPassword, setTempPassword] = useState<string>("");
    const showUserPassword = useRef<null | HTMLDialogElement>(null);
    const [toast, setToast] = useState({
        state: ToastState.null,
        message: "",
        reset: () => {},
    });

    const [searchTerm, setSearchTerm] = useState("");
    const searchQuery = useDebounce(searchTerm, 300);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState("asc");
    const { data, mutate, error, isLoading } = useSWR(
        `/api/v1/users?search=${searchQuery}&page=${pageQuery}&order=${sortQuery}`,
    );
    const userData = data as PaginatedData<User>;
    const showToast = (message: string, state: ToastState) => {
        setToast({
            state,
            message,
            reset: () => {
                setToast({
                    state: ToastState.success,
                    message: "",
                    reset: () => {
                        setDisplayToast(false);
                    },
                });
            },
        });
        setDisplayToast(true);
    };

    const deleteUser = async () => {
        const response = await axios("/api/v1/users/" + targetUser?.id, {
            method: "delete",
            headers: { ContentType: "application/json" },
        });
        const toastType =
            response.status == 204 ? ToastState.success : ToastState.error;
        const message =
            response.status == 204
                ? "User deleted successfully"
                : response.statusText;
        deleteUserModal.current?.close();
        showToast(message, toastType);
        setTargetUser(null);
        mutate();
        return;
    };

    const onAddUserSuccess = (pswd = "", msg: string, type: ToastState) => {
        showToast(msg, type);
        setTempPassword(pswd);
        addUserModal.current?.close();
        showUserPassword.current?.showModal();
        mutate();
    };

    const hanldleEditUser = () => {
        editUserModal.current?.close();
        setTargetUser(null);
        mutate();
    };

    const handleDeleteUserCancel = () => {
        deleteUserModal.current?.close();
        setTargetUser(null);
    };

    const handleResetPasswordCancel = (msg: string, err: boolean) => {
        const state = err ? ToastState.error : ToastState.success;
        if (msg === "" && !err) {
            setTargetUser(null);
            return;
        }
        showToast(msg, state);
        setTargetUser(null);
    };
    const handleDisplayTempPassword = (psw: string) => {
        setTempPassword(psw);
        resetUserPasswordModal.current?.close();
        showUserPassword.current?.showModal();
        showToast("Password Successfully Reset", ToastState.success);
    };
    const handleShowPasswordClose = () => {
        showUserPassword.current?.close();
        setTempPassword("");
    };

    return (
        <AuthenticatedLayout user={auth.user} title="Users">
            <PageNav user={auth.user} path={["Settings", "Users"]} />
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
                <div className="flex justify-between">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="input input-bordered w-full max-w-xs input-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="tooltip tooltip-left" data-tip="Add User">
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
                                {sortQuery == "asc" ? (
                                    <ChevronDownIcon
                                        className="h-4 text-accent cursor-pointer"
                                        onClick={() => setSortQuery("desc")}
                                    />
                                ) : (
                                    <ChevronUpIcon
                                        className="h-4 text-accent cursor-pointer"
                                        onClick={() => setSortQuery("asc")}
                                    />
                                )}
                            </th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading &&
                            !error &&
                            userData.data.map((user: any) => {
                                return (
                                    <tr
                                        key={user.id}
                                        className="border-gray-600"
                                    >
                                        <td>
                                            {user.name_first} {user.name_last}
                                        </td>
                                        <td>{user.username}</td>
                                        <td>{user.role}</td>
                                        <td>
                                            <div
                                                className="tooltip"
                                                data-tip="User Activity"
                                            >
                                                <a className="flex justify-start cursor-pointer">
                                                    <span>Today</span>
                                                    <ArrowUpRightIcon className="w-4 text-accent" />
                                                </a>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex space-x-2 text-accent cursor-pointer">
                                                <div
                                                    className="tooltip"
                                                    data-tip="Edit User"
                                                >
                                                    <PencilIcon
                                                        className="h-4"
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
                                                        className="h-4"
                                                        onClick={() => {
                                                            setTargetUser(user);
                                                            resetUserPasswordModal.current?.showModal();
                                                        }}
                                                    />
                                                </div>
                                                <div
                                                    className="tooltip"
                                                    data-tip="Delete User"
                                                >
                                                    <TrashIcon
                                                        className="h-4"
                                                        onClick={() => {
                                                            setTargetUser(user);
                                                            deleteUserModal.current?.showModal();
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
                {!isLoading && !error && data.data.length != 0 && (
                    <Pagination meta={userData.meta} setPage={setPageQuery} />
                )}
                {error && (
                    <span className="text-center text-error">
                        Failed to load users.
                    </span>
                )}
                {!isLoading && !error && data.data.length == 0 && (
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
                item="User"
                form={
                    <EditUserForm
                        onSuccess={hanldleEditUser}
                        user={targetUser}
                    />
                }
            />
            <Modal
                ref={deleteUserModal}
                type={ModalType.Delete}
                item="User"
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
                type={ModalType.Blank}
                item=""
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
                type={""}
                item={""}
                form={
                    <ShowTempPasswordForm
                        username={targetUser?.username || "New User"}
                        tempPassword={tempPassword}
                        onClose={handleShowPasswordClose}
                    />
                }
            />
            {/* Toasts */}
            {displayToast && <Toast {...toast} />}
        </AuthenticatedLayout>
    );
}
