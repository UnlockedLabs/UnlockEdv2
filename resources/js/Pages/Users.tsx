import { useState } from "react";
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
import { PageProps } from "@/types";
import { User } from "@/common";
import PageNav from "@/Components/PageNav";
import Pagination, { PaginatedData } from "@/Components/Pagination";

export default function Users({ auth }: PageProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const searchQuery = useDebounce(searchTerm, 300);

    const [pageQuery, setPageQuery] = useState(1);

    const [sortQuery, setSortQuery] = useState("asc");

    const { data, error, isLoading } = useSWR(
        `/api/v1/users?search=${searchQuery}&page=${pageQuery}&order=${sortQuery}`,
    );

    const userData = data as PaginatedData<User>;

    console.log(error);

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
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                {!isLoading && !error && data.data.length != 0 && (
                    <Pagination
                        links={userData.links}
                        meta={userData.meta}
                        setPage={setPageQuery}
                    />
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
        </AuthenticatedLayout>
    );
}
