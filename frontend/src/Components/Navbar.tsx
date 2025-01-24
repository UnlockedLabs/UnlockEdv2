import Brand from './Brand';
import {
    AcademicCapIcon,
    BookOpenIcon,
    BuildingStorefrontIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    HomeIcon,
    UsersIcon,
    ArrowRightEndOnRectangleIcon,
    SunIcon,
    MoonIcon,
    UserCircleIcon,
    DocumentTextIcon,
    CloudIcon,
    RssIcon,
    RectangleStackIcon,
    CogIcon,
    LightBulbIcon
} from '@heroicons/react/24/solid';
import {
    getDashboardLink,
    handleLogout,
    hasFeature,
    isAdministrator,
    useAuth
} from '@/useAuth';
import Modal from '@/Components/Modal';
import ULIComponent from './ULIComponent';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import FeatureLevelCheckboxes from './FeatureLevelCheckboxes';
import { FeatureAccess, ToastState, UserRole } from '@/common';
import { useToast } from '@/Context/ToastCtx';
import API from '@/api/api';
import { useRef, useState } from 'react';
import ConfirmSeedDemoDataForm from './forms/ConfirmSeedDemoData';

export default function Navbar({
    isPinned,
    onTogglePin
}: {
    isPinned: boolean;
    onTogglePin: () => void;
}) {
    const { user, setUser } = useAuth();
    if (!user) {
        return null;
    }

    const { toaster } = useToast();
    const confirmSeedModal = useRef<HTMLDialogElement | null>(null);
    const [seedInProgress, setSeedInProgress] = useState<boolean>(false);

    const dashboardTitleStudent = new Map([
        ['/trending-content', 'Trending Content'],
        ['/learning-path', 'Learning Path'],
        ['/program-tracker', 'Program Tracker']
    ]);

    const handleSeedDemoData = async () => {
        setSeedInProgress(true);
        const resp = await API.post<null, object>(`auth/demo-seed`, {});
        if (resp.success) {
            toaster(
                `Demo data seeded for ${user.facility_name}`,
                ToastState.success
            );
            confirmSeedModal.current?.close();
            setSeedInProgress(false);
            return;
        }
        toaster('Error seeding demo data', ToastState.error);
        confirmSeedModal.current?.close();
        setSeedInProgress(false);
    };

    return (
        <div className="w-60 min-w-[240px] flex flex-col bg-background group h-screen">
            <div className="hidden lg:flex self-end py-8 mr-4">
                {isPinned ? (
                    <div
                        className="tooltip tooltip-left mt-10 flex-shrink-0 mt-2 lg:mt-4"
                        data-tip="Close sidebar"
                    >
                        <ChevronDoubleLeftIcon
                            className="w-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration=300 "
                            onClick={onTogglePin}
                        />
                    </div>
                ) : (
                    <div
                        className=" tooltip tooltip-left mt-10 flex-shrink-0 mt-2 lg:mt-4"
                        data-tip="Lock sidebar open"
                    >
                        <ChevronDoubleRightIcon
                            className=" w-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration=300 "
                            onClick={onTogglePin}
                        />
                    </div>
                )}
            </div>

            <Link to="/" className="mt-14">
                <Brand />
            </Link>

            <div className="mt-8 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                <ul className="menu space-y-2 px-2 ">
                    {user && isAdministrator(user) ? (
                        <>
                            {hasFeature(
                                user,
                                FeatureAccess.OpenContentAccess
                            ) && (
                                <li>
                                    <Link to="/knowledge-insights">
                                        <ULIComponent icon={BookOpenIcon} />
                                        Knowledge Insights
                                    </Link>
                                </li>
                            )}
                            {hasFeature(user, FeatureAccess.ProviderAccess) && (
                                <li>
                                    <Link to="/learning-insights">
                                        <ULIComponent icon={LightBulbIcon} />
                                        Learning Insights
                                    </Link>
                                </li>
                            )}
                            <li>
                                <Link to="/operational-insights">
                                    <ULIComponent icon={CogIcon} />
                                    Operational Insights
                                </Link>
                            </li>
                            {hasFeature(user, FeatureAccess.ProviderAccess) && (
                                <>
                                    <li>
                                        <Link to="/course-catalog-admin">
                                            <ULIComponent icon={CloudIcon} />
                                            Course Catalog
                                        </Link>
                                    </li>
                                    <li>
                                        <Link to="/learning-platforms">
                                            <ULIComponent icon={CloudIcon} />
                                            Learning Platforms
                                        </Link>
                                    </li>
                                </>
                            )}
                            {hasFeature(user, FeatureAccess.ProgramAccess) && (
                                <li>
                                    <Link to="/programs">
                                        <ULIComponent icon={DocumentTextIcon} />
                                        Programs
                                    </Link>
                                </li>
                            )}
                            {hasFeature(
                                user,
                                FeatureAccess.OpenContentAccess
                            ) && (
                                <li>
                                    <Link to="/knowledge-center-management/libraries">
                                        <ULIComponent icon={BookOpenIcon} />
                                        Knowledge Center
                                    </Link>
                                </li>
                            )}
                            <li>
                                <Link to="/residents">
                                    <ULIComponent icon={AcademicCapIcon} />
                                    Residents
                                </Link>
                            </li>
                            <li>
                                <Link to="/admins">
                                    <ULIComponent icon={UsersIcon} />
                                    Admins
                                </Link>
                            </li>
                            <li>
                                <Link to="/facilities">
                                    <ULIComponent
                                        icon={BuildingStorefrontIcon}
                                    />
                                    Facilities
                                </Link>
                            </li>
                        </>
                    ) : (
                        <>
                            <li>
                                <Link to={getDashboardLink(user)}>
                                    <ULIComponent icon={HomeIcon} />
                                    {dashboardTitleStudent.get(
                                        getDashboardLink(user)
                                    ) ?? 'Home'}
                                </Link>
                            </li>
                            {hasFeature(user, FeatureAccess.ProviderAccess) && (
                                <>
                                    {getDashboardLink(user) !==
                                        '/learning-path' && (
                                        <li>
                                            <Link to="/learning-path">
                                                <ULIComponent icon={HomeIcon} />
                                                My Learning
                                            </Link>
                                        </li>
                                    )}
                                    <li>
                                        <Link to="/my-courses">
                                            <ULIComponent
                                                icon={RectangleStackIcon}
                                            />
                                            My Courses
                                        </Link>
                                    </li>
                                    <li>
                                        <Link to="/my-progress">
                                            <ULIComponent
                                                icon={AcademicCapIcon}
                                            />
                                            My Progress
                                        </Link>
                                    </li>
                                </>
                            )}
                            {hasFeature(
                                user,
                                FeatureAccess.OpenContentAccess
                            ) && (
                                <>
                                    {user.feature_access.length > 1 && (
                                        <li>
                                            <Link to="/trending-content">
                                                <ULIComponent
                                                    icon={BookOpenIcon}
                                                />
                                                Trending Content
                                            </Link>
                                        </li>
                                    )}
                                    <li>
                                        <Link to="/knowledge-center/libraries">
                                            <ULIComponent icon={BookOpenIcon} />
                                            Knowledge Center
                                        </Link>
                                    </li>
                                </>
                            )}
                            {hasFeature(user, FeatureAccess.ProgramAccess) && (
                                <li>
                                    <Link to="/programs">
                                        <ULIComponent icon={DocumentTextIcon} />
                                        Programs
                                    </Link>
                                </li>
                            )}
                        </>
                    )}
                </ul>
            </div>

            <div className="mt-auto">
                <ul className="menu p-2">
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
                            {user && user.role === UserRole.SystemAdmin && (
                                <>
                                    <li>
                                        <button
                                            className="self-center button"
                                            onClick={() =>
                                                confirmSeedModal.current?.showModal()
                                            }
                                        >
                                            <ULIComponent
                                                icon={RssIcon}
                                                iconClassName={'w-3 h-3'}
                                            />
                                            Seed Demo Data
                                        </button>
                                    </li>
                                    <div className="self-center pt-3">
                                        <strong>Enabled Features:</strong>
                                    </div>
                                    <li>
                                        <FeatureLevelCheckboxes
                                            features={user.feature_access ?? []}
                                            setUser={setUser}
                                        />
                                    </li>
                                </>
                            )}
                            <li className="self-center pt-5">
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
            {confirmSeedModal !== null && (
                <Modal
                    ref={confirmSeedModal}
                    type="Confirm"
                    item="Seed Demo Data"
                    form={
                        <ConfirmSeedDemoDataForm
                            handleClose={() => {
                                confirmSeedModal.current?.close();
                                setSeedInProgress(false);
                                return;
                            }}
                            inProgress={seedInProgress}
                            handleSeedDemoData={handleSeedDemoData}
                        />
                    }
                />
            )}
        </div>
    );
}
