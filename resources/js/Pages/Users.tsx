import { useState } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    ChevronDownIcon,
    ArrowPathRoundedSquareIcon,
    ArrowUpRightIcon,
    PencilIcon,
    TrashIcon,
    UserPlusIcon,
} from "@heroicons/react/24/solid";
import { PageProps } from "@/types";
import { User } from "@/common";
import PageNav from "@/Components/PageNav";
import Pagination, { PaginatedData } from "@/Components/Pagination";

const api: PaginatedData<User> = {
    data: [
        {
            id: 1,
            name_first: "Super",
            name_last: "Admin",
            email: "admin@unlocked.v2",
            role: "admin",
            username: "SuperAdmin",
        },
    ],
    links: {
        first: "http://localhost/api/v1/users?page=1",
        last: "http://localhost/api/v1/users?page=1",
    },
    meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        per_page: 10,
        to: 1,
        total: 1,
    },
};

export default function Users({ auth }: PageProps) {
    const [userData, setUserData] = useState(api);
    const [queryString, setQueryString] = useState("");

    const onAddUser = () => {
        alert("add user");
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
                        value={queryString}
                        onChange={(e) => setQueryString(e.target.value)}
                    />
                    <div className="tooltip tooltip-left" data-tip="Add User">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={onAddUser}
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
                                <ChevronDownIcon className="h-4 text-accent cursor-pointer" />
                            </th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {userData.data.map((user) => {
                            return (
                                <tr className="border-gray-600">
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
                                                <PencilIcon className="h-4" />
                                            </div>
                                            <div
                                                className="tooltip"
                                                data-tip="Reset Password"
                                            >
                                                <ArrowPathRoundedSquareIcon className="h-4" />
                                            </div>
                                            <div
                                                className="tooltip"
                                                data-tip="Delete User"
                                            >
                                                <TrashIcon className="h-4" />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination links={api.links} meta={api.meta} />
            </div>
        </AuthenticatedLayout>
    );
}
