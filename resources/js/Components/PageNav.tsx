import { User, UserRole } from "@/common";
import {
    ArrowRightOnRectangleIcon,
    HomeIcon,
    UsersIcon,
    ChartBarIcon,
    RectangleStackIcon,
    ArchiveBoxIcon,
} from "@heroicons/react/24/solid";
import { Link } from "@inertiajs/react";
import ThemeToggle from "./ThemeToggle";

export default function PageNav({
    user,
    path,
}: {
    user: User;
    path: Array<string>;
}) {
    return (
        <div className="navbar">
            <div className="navbar-start breadcrumbs pl-0">
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
                            <ul className="bg-base-300 z-[1]">
                                <li>
                                    <label className="flex cursor-pointer gap-2">
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
                                        <ThemeToggle />
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
                                        {/* Student specific options go here */}
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
                                            <a href="/user-activity">
                                                <ChartBarIcon className="h-4" />
                                                Activity
                                            </a>
                                        </li>
                                        <li>
                                            <a href="/left-menu-management">
                                                <ArchiveBoxIcon className="h-4" />
                                                Left Menu
                                            </a>
                                        </li>
                                        <li>
                                            <a href="/provider-platform-management">
                                                <RectangleStackIcon className="h-4" />
                                                Platforms
                                            </a>
                                        </li>
                                    </>
                                )}

                                <div className="divider mt-0 mb-0"></div>

                                <li>
                                    <Link href={route("logout")} method="post">
                                        <ArrowRightOnRectangleIcon className="h-4" />
                                        Logout
                                    </Link>
                                </li>
                            </ul>
                        </details>
                    </li>
                </ul>
            </div>
        </div>
    );
}
