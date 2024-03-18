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
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { PageProps } from "@/types";
import { User } from "@/common";
import PageNav from "@/Components/PageNav";
import Pagination, { PaginatedData } from "@/Components/Pagination";
import AddUserForm from "@/Components/forms/AddUserForm";
import EditUserForm from "@/Components/forms/EditUserForm";

export default function Users({ auth }: PageProps) {
    const addUserModal = useRef<null | HTMLDialogElement>(null);
    const editUserModal = useRef<null | HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<null | HTMLDialogElement>(null);
    const deleteUserModal = useRef<null | HTMLDialogElement>(null);

    const [targetUser, setTargetUser] = useState<null | User>(null);

    const showUserPassword = useRef<null | HTMLDialogElement>(null);
    const [tempPassword, setTempPassword] = useState("");
    const [toast, setToast] = useState({
        message: "",
        type: "success",
        isVisible: false,
    });

    const [searchTerm, setSearchTerm] = useState("");
    const searchQuery = useDebounce(searchTerm, 300);

    const [pageQuery, setPageQuery] = useState(1);

    const [sortQuery, setSortQuery] = useState("asc");

    const { data, mutate, error, isLoading } = useSWR(
        `/api/v1/users?search=${searchQuery}&page=${pageQuery}&order=${sortQuery}`,
    );

    const userData = data as PaginatedData<User>;

    const showToast = (message: string, type = "success") => {
        setToast({ message, type, isVisible: true });
        setTimeout(() => {
            setToast((t) => ({ ...t, isVisible: false }));
        }, 5000);
    };

    const getTempPassword = async () => {
        resetUserPasswordModal.current?.close();
        showUserPassword.current?.showModal();

        try {
            const response = await axios("/student-password", {
                method: "post",
                headers: { ContentType: "application/json" },
                data: { user_id: targetUser?.id },
            });

            if (response.status !== 201) {
                showUserPassword.current?.close();
                showToast(response.data.data.message, "error");
                return;
            }

            setTempPassword(response.data.data["password"]);
            showToast(response.data.message, "success");
            return;
        } catch (error: any) {
            showUserPassword.current?.close();
            showToast(error.response.data.message, "error");
            return;
        }
    };

    const deleteUser = async () => {
        const response = await axios("/api/v1/users/" + targetUser?.id, {
            method: "delete",
            headers: { ContentType: "application/json" },
        });
        const toastType = response.status == 204 ? "success" : "error";
        const message =
            response.status == 204
                ? "User deleted successfully"
                : response.statusText;
        deleteUserModal.current?.close();
        showToast(message, toastType);
        setTargetUser(null);
        return;
    };

    const onAddUserSuccess = (pswd = "", msg: string, type: string) => {
        showToast(msg, type);
        addUserModal.current?.close();
        setTempPassword(pswd);
        showUserPassword.current?.showModal();
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

            {/* Modals */}
            <dialog ref={addUserModal} className="modal">
                <div className="modal-box">
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Add User
                        </span>
                        <AddUserForm onSuccess={onAddUserSuccess} />
                    </div>
                </div>
            </dialog>

            <dialog ref={editUserModal} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => {
                                setTargetUser(null);
                            }}
                        >
                            ✕
                        </button>
                    </form>

                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Edit User
                        </span>
                        <EditUserForm
                            onSuccess={() => {
                                mutate();
                                editUserModal.current?.close();
                                setTargetUser(null);
                            }}
                            user={targetUser}
                        />
                    </div>
                </div>
            </dialog>

            <dialog ref={resetUserPasswordModal} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-xl">
                        <p>Reset User's Password?</p>
                    </h3>
                    <h4 className="font-bold text-l text-secondary">
                        <br />
                        <p>Note: Only for non-administrator accounts.</p>
                    </h4>
                    <p className="py-4"></p>
                    <div className="modal-action">
                        <button
                            className="btn btn-warning"
                            onClick={() => {
                                getTempPassword();
                            }}
                        >
                            Reset
                        </button>
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button
                                className="btn"
                                onClick={() => setTempPassword("")}
                            >
                                Close
                            </button>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog ref={showUserPassword} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-xl">
                        Temporary Password for {targetUser?.username}
                    </h3>
                    <br />
                    <p className="py-4 text-xl">{tempPassword}</p>
                    <h4 className="font-bold text-l text-secondary">
                        <p>Be sure to write this down</p>
                    </h4>
                    <div className="modal-action">
                        <button
                            className="btn btn-primary"
                            onClick={() => showUserPassword.current?.close()}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </dialog>

            <dialog ref={deleteUserModal} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-xl">Delete User?</h3>
                    <p className="py-4"></p>
                    <div className="modal-action">
                        <button
                            className="btn btn-warning"
                            onClick={deleteUser}
                        >
                            Delete
                        </button>
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button
                                className="btn"
                                onClick={() => setTargetUser(null)}
                            >
                                Close
                            </button>
                        </form>
                    </div>
                </div>
            </dialog>

            {/* Toasts */}
            {toast.isVisible && (
                <div
                    className={`toast transition-opacity duration-500 ease-out ${
                        toast.isVisible ? "opacity-100" : "opacity-0"
                    }`}
                >
                    <div className={`alert alert-${toast.type}`}>
                        <CheckCircleIcon className="h-6" />
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
