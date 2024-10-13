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
    UsersIcon
} from '@heroicons/react/24/solid';
import { useAuth } from '@/useAuth';
import ULIComponent from './ULIComponent';

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
                {user.user?.role == UserRole.Admin ? (
                    <>
                        {/* admin view */}
                        <li className="mt-16">
                            <a href="/dashboard">
                                <ULIComponent icon={HomeIcon} /> Dashboard
                            </a>
                        </li>
                        <li>
                            <a href="/student-management">
                                <ULIComponent icon={AcademicCapIcon} />
                                Students
                            </a>
                        </li>
                        <li>
                            <a href="/admin-management">
                                <ULIComponent icon={UsersIcon} />
                                Admins
                            </a>
                        </li>
                        <li>
                            <a href="/open-content-management">
                                <ULIComponent icon={BookOpenIcon} />
                                Open Content
                            </a>
                        </li>
                        <li>
                            <a href="/resources-management">
                                <ULIComponent icon={ArchiveBoxIcon} />
                                Resources
                            </a>
                        </li>
                        <li>
                            <a href="/provider-platform-management">
                                <ULIComponent icon={RectangleStackIcon} />
                                Platforms
                            </a>
                        </li>
                    </>
                ) : (
                    <>
                        {/* student view */}
                        <li className="mt-16">
                            <a href="/dashboard">
                                <ULIComponent icon={HomeIcon} /> Dashboard
                            </a>
                        </li>
                        <li className="">
                            <a href="/my-courses">
                                <ULIComponent icon={BookOpenIcon} /> My Courses
                            </a>
                        </li>
                        <li className="">
                            <a href="/my-progress">
                                <ULIComponent icon={TrophyIcon} /> My Progress
                            </a>
                        </li>
                        <li>
                            <a href="/open-content">
                                <ULIComponent icon={BookOpenIcon} />
                                Open Content
                            </a>
                        </li>
                        <li className="">
                            <a href="/course-catalog">
                                <ULIComponent icon={BuildingStorefrontIcon} />
                                Course Catalog
                            </a>
                        </li>
                    </>
                )}
            </ul>
        </div>
    );
}
