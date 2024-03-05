import PageNav from "@/Components/PageNav";
import Pagination, { PaginatedData } from "@/Components/Pagination";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";
import { Activity } from "@/common";
import { useState } from "react";
import useSWR from "swr";
import { useDebounce } from "usehooks-ts";

import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";

export default function UserActivity({ auth }: PageProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const searchQuery = useDebounce(searchTerm, 300);

    const [pageQuery, setPageQuery] = useState(1);

    const [sortQuery, setSortQuery] = useState("desc");

    const { data, error, isLoading } = useSWR(
        `/api/v1/user-activities?search=${searchQuery}&page=${pageQuery}&order=${sortQuery}`,
    );

    const userActivityData = data as PaginatedData<Activity>;

    return (
        <AuthenticatedLayout user={auth.user} title="User Activity">
            <PageNav user={auth.user} path={["Settings", "User Activity"]} />
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
                <div className="flex justify-between">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="input input-bordered w-full max-w-xs input-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <table className="table">
                    <thead>
                        <tr className="border-gray-600">
                            <th className="flex flex-row">
                                <span>User</span>
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
                            <th>Browser</th>
                            <th>URL</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading &&
                            !error &&
                            userActivityData.data.map(
                                (activityInstance: any) => {
                                    const dateTime = new Date(
                                        activityInstance.created_at,
                                    );
                                    return (
                                        <tr
                                            // come up with a better key that is unique
                                            key={activityInstance.id}
                                            className="border-gray-600"
                                        >
                                            <td>
                                                {activityInstance.user_name_first +
                                                    " " +
                                                    activityInstance.user_name_last}
                                            </td>
                                            <td>
                                                {activityInstance.browser_name}
                                            </td>
                                            <td>
                                                <a
                                                    className="flex justify-start cursor-pointer"
                                                    href={
                                                        activityInstance.clicked_url
                                                    }
                                                >
                                                    <span>
                                                        {
                                                            activityInstance.clicked_url
                                                        }
                                                    </span>
                                                </a>
                                            </td>
                                            <td>
                                                {dateTime.toLocaleString(
                                                    "en-US",
                                                )}
                                                {/* <div
                                                className="tooltip"
                                                data-tip="User Activity"
                                            >
                                            </div> */}
                                            </td>
                                        </tr>
                                    );
                                },
                            )}
                    </tbody>
                </table>
                {!isLoading && !error && data.data.length != 0 && (
                    <Pagination
                        meta={userActivityData.meta}
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
