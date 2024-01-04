import { User, UserRole } from "@/common";
import {
    ArrowRightOnRectangleIcon,
    DocumentTextIcon,
    HomeIcon,
    UsersIcon,
} from "@heroicons/react/24/solid";

export default function PageNav({
    user,
    path,
}: {
    user: User;
    path: Array<string>;
}) {
    return (
        <div className="navbar">
            <div className="navbar-start breadcrumbs pl-2">
                <ul>
                    <li>
                        <HomeIcon className="h-5" />
                    </li>
                    {path.map((p) => (
                        <li key={p}>{p}</li>
                    ))}
                </ul>
            </div>
            <div className="navbar-end">
                <ul className="menu menu-horizontal px-1">
                    <li>
                        <details>
                            <summary>
                                <span className="font-semibold">
                                    {user.name_first} {user.name_last}
                                </span>
                            </summary>
                            <ul className="p-2 bg-base-300 z-[1]">
                                <li>
                                    <label className="flex cursor-pointer gap-2 focus:bg-red-500">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <circle cx="12" cy="12" r="5" />
                                            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                                        </svg>
                                        <input
                                            type="checkbox"
                                            value="light"
                                            className="toggle theme-controller"
                                        />
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                        </svg>
                                    </label>
                                </li>

                                {user.role == UserRole.Student ? (
                                    <li>
                                        <div>
                                            <ArrowRightOnRectangleIcon className="h-4" />
                                            Logout
                                        </div>
                                    </li>
                                ) : (
                                    <>
                                        <li>
                                            <a href="/users">
                                                <UsersIcon className="h-4" />
                                                Users
                                            </a>
                                        </li>
                                        <li>
                                            <div>
                                                <DocumentTextIcon className="h-4" />
                                                Content
                                            </div>
                                        </li>
                                    </>
                                )}

                                <li>
                                    <div>
                                        <ArrowRightOnRectangleIcon className="h-4" />
                                        Logout
                                    </div>
                                </li>
                            </ul>
                        </details>
                    </li>
                </ul>
            </div>
        </div>
    );
}
