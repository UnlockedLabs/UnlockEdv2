import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    ArrowPathRoundedSquareIcon,
    ArrowUpRightIcon,
    PencilIcon,
    TrashIcon,
    UserPlusIcon,
} from "@heroicons/react/24/solid";
import { PageProps } from "@/types";

export default function Users({ auth }: PageProps) {
    return (
        <AuthenticatedLayout user={auth.user} title="User">
            <h1 className="font-semibold text-3xl mb-8">Users</h1>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg bg-gray-700 p-6">
                <div className="flex justify-between">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="input input-bordered input-primary w-full max-w-xs"
                    />
                    <button className="btn btn-primary">
                        <UserPlusIcon className="h-4" />
                        Add User
                    </button>
                </div>
                <table className="table">
                    {/* head */}
                    <thead>
                        <tr className="border-gray-600">
                            <th>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary bg-gray-800"
                                    />
                                </label>
                            </th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* row 1 */}
                        <tr className="border-gray-600">
                            <th>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary bg-gray-800"
                                    />
                                </label>
                            </th>
                            <td>
                                <div className="flex items-center gap-3">
                                    <div>
                                        <div className="font-bold">
                                            Super Admin
                                        </div>
                                        <div className="text-sm opacity-50">
                                            super.admin
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>Admin</td>
                            <td>
                                <div className="flex justify-start">
                                    <span>Today</span>
                                    <ArrowUpRightIcon className="w-4 text-primary" />
                                </div>
                            </td>
                            <th>
                                <div className="flex space-x-2">
                                    <button className="btn btn-sm btn-primary">
                                        <PencilIcon className="h-4" />
                                    </button>
                                    <button className="btn btn-sm btn-warning">
                                        <ArrowPathRoundedSquareIcon className="h-4" />
                                    </button>
                                </div>
                            </th>
                        </tr>
                        {/* row 2 */}
                        <tr className="border-gray-600">
                            <th>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary bg-gray-800"
                                    />
                                </label>
                            </th>
                            <td>
                                <div className="flex items-center gap-3">
                                    <div>
                                        <div className="font-bold">
                                            Nokie Rae
                                        </div>
                                        <div className="text-sm opacity-50">
                                            nokie.rae
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>Admin</td>
                            <td>
                                <div className="flex justify-start">
                                    <span>Today</span>
                                    <ArrowUpRightIcon className="w-4 text-primary" />
                                </div>
                            </td>
                            <th>
                                <div className="flex space-x-2">
                                    <button className="btn btn-sm btn-primary">
                                        <PencilIcon className="h-4" />
                                    </button>
                                    <button className="btn btn-sm btn-warning">
                                        <ArrowPathRoundedSquareIcon className="h-4" />
                                    </button>
                                    <button className="btn btn-sm btn-error">
                                        <TrashIcon className="h-4" />
                                    </button>
                                </div>
                            </th>
                        </tr>
                    </tbody>
                </table>
                <div className="join place-content-center">
                    <button className="join-item btn btn-primary">1</button>
                    <button className="join-item btn">2</button>
                    <button className="join-item btn">3</button>
                    <button className="join-item btn">4</button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
