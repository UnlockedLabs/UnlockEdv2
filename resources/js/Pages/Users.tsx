import { useRef, useState } from "react";
import { useDebounce } from "usehooks-ts";
import useSWR from "swr";

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

export default function Users({ auth }: PageProps) {
    const addUserModal = useRef<null | HTMLDialogElement>(null);
    const editUserModal = useRef<null | HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<null | HTMLDialogElement>(null);
    const deleteUserModal = useRef<null | HTMLDialogElement>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const searchQuery = useDebounce(searchTerm, 300);

    const [pageQuery, setPageQuery] = useState(1);

    const [sortQuery, setSortQuery] = useState("asc");

    const { data, error, isLoading } = useSWR(
        `/api/v1/users?search=${searchQuery}&page=${pageQuery}&order=${sortQuery}`,
    );

    const userData = data as PaginatedData<User>;

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
                                                        onClick={() =>
                                                            editUserModal.current?.showModal()
                                                        }
                                                    />
                                                </div>
                                                <div
                                                    className="tooltip"
                                                    data-tip="Reset Password"
                                                >
                                                    <ArrowPathRoundedSquareIcon
                                                        className="h-4"
                                                        onClick={() =>
                                                            resetUserPasswordModal.current?.showModal()
                                                        }
                                                    />
                                                </div>
                                                <div
                                                    className="tooltip"
                                                    data-tip="Delete User"
                                                >
                                                    <TrashIcon
                                                        className="h-4"
                                                        onClick={() =>
                                                            deleteUserModal.current?.showModal()
                                                        }
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
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                            ✕
                        </button>
                    </form>

                    <div className="flex flex-col items-centerz">
                        <span className="text-3xl font-semibold pb-6 text-white">
                            Add User
                        </span>
                        <AddUserForm
                            onSuccess={() => addUserModal.current?.close()}
                        />
                    </div>
                </div>
            </dialog>

            <dialog ref={editUserModal} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                            ✕
                        </button>
                    </form>
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-semibold pb-6 text-white">
                            Edit User
                        </span>
                        <label className="form-control w-full max-w-xs">
                            <div className="label">
                                <span className="label-text">First Name</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Type here"
                                className="input input-bordered w-full max-w-xs"
                            />
                        </label>
                        <label className="form-control w-full max-w-xs">
                            <div className="label">
                                <span className="label-text">Last Name</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Type here"
                                className="input input-bordered w-full max-w-xs"
                            />
                        </label>
                        <label className="form-control w-full max-w-xs">
                            <div className="label">
                                <span className="label-text">Username</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Type here"
                                className="input input-bordered w-full max-w-xs"
                            />
                        </label>
                        <label className="form-control w-full max-w-xs">
                            <div className="label">
                                <span className="label-text">Role</span>
                            </div>
                            <select className="select select-bordered">
                                <option disabled selected>
                                    Pick one
                                </option>
                                <option>Student</option>
                                <option>Admin</option>
                            </select>
                        </label>
                        <label className="p-6">
                            <div></div>
                        </label>
                        <label className="form-control">
                            <button className="btn btn-primary">Submit</button>
                        </label>
                    </div>
                </div>
            </dialog>

            <dialog ref={resetUserPasswordModal} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-xl">
                        Reset User's Password?
                    </h3>
                    <p className="py-4"></p>
                    <div className="modal-action">
                        <button className="btn btn-warning">Reset</button>
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog ref={deleteUserModal} className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-xl">Delete User?</h3>
                    <p className="py-4"></p>
                    <div className="modal-action">
                        <button className="btn btn-warning">Delete</button>
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            {/* Toasts */}
            <div className="toast transition-opacity duration-500 ease-out opacity-0">
                <div className="alert alert-success">
                    <CheckCircleIcon className="h-6" />
                    <span>User created!</span>
                </div>
            </div>

            <div className="toast transition-opacity duration-500 ease-out opacity-0">
                <div className="alert alert-success">
                    <CheckCircleIcon className="h-6" />
                    <span>User updated!</span>
                </div>
            </div>

            <div className="toast transition-opacity duration-500 ease-out opacity-0">
                <div className="alert alert-success">
                    <CheckCircleIcon className="h-6" />
                    <span>User password reset!</span>
                </div>
            </div>

            <div className="toast transition-opacity duration-500 ease-out opacity-0">
                <div className="alert alert-success">
                    <CheckCircleIcon className="h-6" />
                    <span>User deleted!</span>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
