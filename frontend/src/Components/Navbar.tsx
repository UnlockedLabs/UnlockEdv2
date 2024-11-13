import { UserRole } from '@/common';
import Brand from './Brand';
import {
    AcademicCapIcon,
    ArchiveBoxIcon,
    BookOpenIcon,
    BuildingStorefrontIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    HomeIcon,
    RectangleStackIcon,
    TrophyIcon,
    UsersIcon,
    ArrowRightEndOnRectangleIcon,
    SunIcon,
    MoonIcon,
    UserCircleIcon
} from '@heroicons/react/24/solid';
import { useAuth, handleLogout } from '@/useAuth';
import ULIComponent from './ULIComponent';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function Navbar({
    isPinned,
    onTogglePin
}: {
    isPinned: boolean;
    onTogglePin: () => void;
}) {
    const { user } = useAuth();

    return (
        <div className="w-60 min-w-[240px] flex flex-col bg-background group h-screen">
            <div className="hidden lg:flex self-end py-6 mr-4">
                {isPinned ? (
                    <div
                        className="tooltip tooltip-left"
                        data-tip="Close sidebar"
                    >
                        <ChevronDoubleLeftIcon
                            className="w-4 opacity-0 group-hover:opacity-100 transition-opacity duration=300 cursor-pointer"
                            onClick={onTogglePin}
                        ></ChevronDoubleLeftIcon>
                    </div>
                ) : (
                    <div
                        className="tooltip tooltip-left"
                        data-tip="Lock sidebar open"
                    >
                        <ChevronDoubleRightIcon
                            className="w-4 opacity-0 group-hover:opacity-100 transition-opacity duration=300 cursor-pointer"
                            onClick={onTogglePin}
                        ></ChevronDoubleRightIcon>
                    </div>
                )}
            </div>

            <Link to="/" className="mt-16">
                <Brand />
            </Link>

            <div className="h-full">
                <ul className="menu h-full flex flex-col justify-between">
                    <div>
                        {user?.role == UserRole.Admin ? (
                            <>
                                {/* admin view */}
                                <li className="mt-16">
                                    <Link to="/admin-dashboard">
                                        <ULIComponent icon={HomeIcon} />
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/student-management">
                                        <ULIComponent icon={AcademicCapIcon} />
                                        Students
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/admin-management">
                                        <ULIComponent icon={UsersIcon} />
                                        Admins
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/open-content-management">
                                        <ULIComponent icon={BookOpenIcon} />
                                        Open Content
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/resources-management">
                                        <ULIComponent icon={ArchiveBoxIcon} />
                                        Resources
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/provider-platform-management">
                                        <ULIComponent
                                            icon={RectangleStackIcon}
                                        />
                                        Platforms
                                    </Link>
                                </li>
                                {/* <li>
                                    <Link to="/programs">
                                        <ULIComponent
                                            icon={RectangleStackIcon}
                                        />
                                        Programs
                                    </Link>
                                </li> */}
                            </>
                        ) : (
                            <>
                                {/* student view */}
                                <li className="mt-16">
                                    <Link to="/student-dashboard">
                                        <ULIComponent icon={HomeIcon} />
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/my-courses">
                                        <ULIComponent icon={BookOpenIcon} /> My
                                        Courses
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/my-progress">
                                        <ULIComponent icon={TrophyIcon} /> My
                                        Progress
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/open-content">
                                        <ULIComponent icon={BookOpenIcon} />
                                        Open Content
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/course-catalog">
                                        <ULIComponent
                                            icon={BuildingStorefrontIcon}
                                        />
                                        Course Catalog
                                    </Link>
                                </li>
                            </>
                        )}
                    </div>
                    <li className="dropdown dropdown-right dropdown-end w-full">
                        <div tabIndex={0} role="button">
                            <ULIComponent
                                icon={UserCircleIcon}
                                iconClassName={'w-5 h-5'}
                            />
                            {user?.name_first} {user?.name_last}
                        </div>
                        <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-grey-2 dark:bg-grey-1 rounded-box z-50 w-52 p-2 shadow"
                        >
                            <li className="self-center">
                                <label className="flex cursor-pointer gap-2">
                                    <ULIComponent
                                        icon={SunIcon}
                                        iconClassName={'w-6 h-6'}
                                    />
                                    <ThemeToggle />
                                    <ULIComponent
                                        icon={MoonIcon}
                                        iconClassName={'w-6 h-6'}
                                    />
                                </label>
                            </li>
                            <div className="divider mt-0 mb-0"></div>
                            <li tabIndex={0} className="collapse ">
                                <label>Feature Access Levels</label>

                                <ul
                                    tabIndex={0}
                                    className="collapse-content menu bg-grey-2 dark:bg-grey-1 rounded-box text-xs"
                                >
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="access_level"
                                                value={'Open Content'}
                                            />
                                            Open Content
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="access_level"
                                                value={'Open Content'}
                                            />
                                            Provider Platform Integrations
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="access_level"
                                                value={'Open Content'}
                                            />
                                            Program Management
                                        </label>
                                    </li>
                                </ul>
                            </li>
                            <li className="self-center">
                                <button
                                    onClick={() => {
                                        void handleLogout();
                                    }}
                                >
                                    <ArrowRightEndOnRectangleIcon className="h-4" />
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    );
}
