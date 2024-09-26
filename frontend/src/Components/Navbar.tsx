import { UserRole } from '@/common';
import Brand from './Brand';
import {
    ArchiveBoxIcon,
    AcademicCapIcon,
    BookOpenIcon,
    BuildingStorefrontIcon,
    HomeIcon,
    RectangleStackIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    TrophyIcon,
    UsersIcon
} from '@heroicons/react/24/solid';
import { useAuth } from '@/AuthContext';

export default function Navbar({
    isPinned,
    onTogglePin
}: {
    isPinned: boolean;
    onTogglePin: () => void;
}) {
    const user = useAuth();
    return (
        <div className="w-60 min-w-[240px] h-screen flex flex-col justify-start bg-background group">
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

            <a href="/" className="mt-16">
                <Brand />
            </a>

            <ul className="menu">
                {user.user.role == UserRole.Admin ? (
                    <>
                        {/* admin view */}
                        <li className="mt-16">
                            <a href="/dashboard">
                                <HomeIcon className="w-4" /> Dashboard
                            </a>
                        </li>
                        <li>
                            <a href="/student-management">
                                <AcademicCapIcon className="h-4" />
                                Students
                            </a>
                        </li>
                        <li>
                            <a href="/admin-management">
                                <UsersIcon className="h-4" />
                                Admins
                            </a>
                        </li>
                        <li>
                            <a href="/resources-management">
                                <ArchiveBoxIcon className="h-4" />
                                Resources
                            </a>
                        </li>
                        <li>
                            <a href="/provider-platform-management">
                                <RectangleStackIcon className="h-4" />
                                Platforms
                            </a>
                        </li>
                    </>
                ) : (
                    <>
                        {/* student view */}
                        <li className="mt-16">
                            <a href="/dashboard">
                                <HomeIcon className="w-4" /> Dashboard
                            </a>
                        </li>
                        <li className="">
                            <a href="/my-courses">
                                <BookOpenIcon className="w-4" /> My Courses
                            </a>
                        </li>
                        <li className="">
                            <a href="/my-progress">
                                <TrophyIcon className="w-4" /> My Progress
                            </a>
                        </li>
                        <li className="">
                            <a href="/course-catalog">
                                <BuildingStorefrontIcon className="w-4" />{' '}
                                Course Catalog
                            </a>
                        </li>
                    </>
                )}
            </ul>
            {/* <div className="">
                <ul className="menu mb-5">
                    <li>
                        <button onClick={() => handleLogout()}>
                            <ArrowRightEndOnRectangleIcon className="h-4" />
                            Logout
                        </button>
                    </li>
                </ul>
            </div> */}
        </div>
    );
}
