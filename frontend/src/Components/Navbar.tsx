import Brand from './Brand';
import {
    AcademicCapIcon,
    ArchiveBoxIcon,
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
    RectangleStackIcon
} from '@heroicons/react/24/solid';
import { handleLogout, hasFeature, isAdministrator, useAuth } from '@/useAuth';
import ULIComponent from './ULIComponent';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import FeatureLevelCheckboxes from './FeatureLevelCheckboxes';
import { FeatureAccess, UserRole } from '@/common';

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
                        {user && isAdministrator(user) ? (
                            <>
                                {/* admin view */}
                                {/* Checks if feature access.length === 0 then renders admin dasboard */}

                                {user.feature_access.length === 1 &&
                                hasFeature(
                                    user,
                                    FeatureAccess.OpenContentAccess
                                ) ? (
                                    <li className="mt-16">
                                        <Link to="/open-content-dashboard">
                                            <ULIComponent icon={HomeIcon} />
                                            Dashboard
                                        </Link>
                                    </li>
                                ) : (
                                    <li className="mt-16">
                                        <Link to="/admin-dashboard">
                                            <ULIComponent icon={HomeIcon} />
                                            Dashboard
                                        </Link>
                                    </li>
                                )}

                                {/* TODO: Check each level for 1 selected */}

                                {/* feature level access is 2  oc & pi */}
                                {user.feature_access.length === 2 &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.OpenContentAccess
                                    ) &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.ProviderAccess
                                    ) && (
                                        <>
                                            <li>
                                                <Link to="/learning-platforms">
                                                    <ULIComponent
                                                        icon={CloudIcon}
                                                    />
                                                    Learning Platforms
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/open-content-management/libraries">
                                                    <ULIComponent
                                                        icon={BookOpenIcon}
                                                    />
                                                    Open Content
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/resources-management">
                                                    <ULIComponent
                                                        icon={ArchiveBoxIcon}
                                                    />
                                                    Resources
                                                </Link>
                                            </li>
                                        </>
                                    )}
                                {/* feature level access is 2  oc & prog */}

                                {user.feature_access.length === 2 &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.OpenContentAccess
                                    ) &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.ProgramAccess
                                    ) && (
                                        <>
                                            <li>
                                                <Link to="/programs">
                                                    <ULIComponent
                                                        icon={DocumentTextIcon}
                                                    />
                                                    Programs
                                                </Link>
                                            </li>

                                            <li>
                                                <Link to="/open-content-management/libraries">
                                                    <ULIComponent
                                                        icon={BookOpenIcon}
                                                    />
                                                    Open Content
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/resources-management">
                                                    <ULIComponent
                                                        icon={ArchiveBoxIcon}
                                                    />
                                                    Resources
                                                </Link>
                                            </li>
                                        </>
                                    )}

                                {/* feature level access is 2  pi & prog */}
                                {user.feature_access.length === 2 &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.ProviderAccess
                                    ) &&
                                    hasFeature(
                                        user,
                                        FeatureAccess.ProgramAccess
                                    ) && (
                                        <>
                                            <li>
                                                <Link to="/programs">
                                                    <ULIComponent
                                                        icon={DocumentTextIcon}
                                                    />
                                                    Programs
                                                </Link>
                                            </li>

                                            <li>
                                                <Link to="/learning-platforms">
                                                    <ULIComponent
                                                        icon={CloudIcon}
                                                    />
                                                    Learning Platforms
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/resources-management">
                                                    <ULIComponent
                                                        icon={ArchiveBoxIcon}
                                                    />
                                                    Resources
                                                </Link>
                                            </li>
                                        </>
                                    )}

                                {/* 
                                    1. 0 features selected = admin-dashboard
                                        - Dashboard 
                                        - Students
                                        - Admins
                                        - Resources
                                        - Facilities

                                    2. 1 Open Content = open-content-dashboard
                                        - Dashboard
                                        - Open Content
                                        - Students
                                        - Admins
                                        - Resources
                                        - Facilities

                                    3. 1 Provider Platform Integrations = admin-dashboard
                                        - Student Activity = admin-dashboard
                                        - Learning Platforms
                                        - Students
                                        - Admins
                                        - Facilities

                                    4. 1 Program Management = ??? (admin dashboard for now)
                                        - Dashboard
                                        - Programs
                                        - Students
                                        - Admins
                                        - Resources
                                        - Facilities

                                    Now comes the first of the scenarios where there are two feature level access items selected
                                    In this case and as it was explained to me by Chris 12-3-24 at our 11am meeting, the dashboard rendered and the link that is at the
                                     top of the left-nav will be the dashboard of the feature level with the highest number 
                                     (1 - open-content, 2 - provider platforms, 3 - programs),we will see 
                                    the following: 

                                    5. 2 Open Content && Provider Platforms = admin-dashboard (one day these may all have their own version of a dashboard/landing-pg)
                                        - Dashboard
                                        - Learning Platforms
                                        - Open Content
                                        - Resources
                                        - Students
                                        - Admins                                        
                                        - Facilities

                                    6. 2 Open Content && Programs = admin-dashboard
                                        - Dashboard 
                                        - Programs
                                        - Open Content
                                        - Resources
                                        - Students
                                        - Admins                                        
                                        - Facilities
                                    
                                    7. 2 Provider Platforms && Programs = admin-dashboard
                                        - Dashboard
                                        - Programs
                                        - Learning Platforms
                                        - Resources                                        
                                        - Students
                                        - Admins
                                        - Facilities                               
                                */}

                                {hasFeature(
                                    user,
                                    FeatureAccess.OpenContentAccess
                                ) && (
                                    <>
                                        {/* {user.feature_access.length === 1 ? (
                                            <li className="mt-16">
                                                <Link to="/open-content-dashboard">
                                                    <ULIComponent
                                                        icon={HomeIcon}
                                                    />
                                                    Dashboard
                                                </Link>
                                            </li>
                                        ) : (
                                            <li className="mt-16">
                                                <Link to="/admin-dashboard">
                                                    <ULIComponent
                                                        icon={HomeIcon}
                                                    />
                                                    Dashboard
                                                </Link>
                                            </li>
                                        )} */}
                                        <li>
                                            <Link to="/open-content-management/libraries">
                                                <ULIComponent
                                                    icon={BookOpenIcon}
                                                />
                                                Open Content
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/students">
                                                <ULIComponent
                                                    icon={AcademicCapIcon}
                                                />
                                                Students
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/admins">
                                                <ULIComponent
                                                    icon={UsersIcon}
                                                />
                                                Admins
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/resources-management">
                                                <ULIComponent
                                                    icon={ArchiveBoxIcon}
                                                />
                                                Resources
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/facilities">
                                                <ULIComponent
                                                    icon={
                                                        BuildingStorefrontIcon
                                                    }
                                                />
                                                Facilities
                                            </Link>
                                        </li>
                                    </>
                                )}
                                {hasFeature(
                                    user,
                                    FeatureAccess.ProviderAccess
                                ) && (
                                    <>
                                        {user.feature_access.length === 1 ? (
                                            <li className="mt-16">
                                                <Link to="/admin-dashboard">
                                                    <ULIComponent
                                                        icon={HomeIcon}
                                                    />
                                                    Student Activity
                                                </Link>
                                            </li>
                                        ) : (
                                            <li>
                                                Not sure the alternative yet
                                            </li>
                                        )}

                                        {!hasFeature(
                                            user,
                                            FeatureAccess.OpenContentAccess
                                        ) && (
                                            <>
                                                <li>
                                                    <Link to="/students">
                                                        <ULIComponent
                                                            icon={
                                                                AcademicCapIcon
                                                            }
                                                        />
                                                        Students
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link to="/admins">
                                                        <ULIComponent
                                                            icon={UsersIcon}
                                                        />
                                                        Admins
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link to="/facilities">
                                                        <ULIComponent
                                                            icon={
                                                                BuildingStorefrontIcon
                                                            }
                                                        />
                                                        Facilities
                                                    </Link>
                                                </li>
                                            </>
                                        )}

                                        <li>
                                            <Link to="/learning-platforms">
                                                <ULIComponent
                                                    icon={CloudIcon}
                                                />
                                                Learning Platforms
                                            </Link>
                                        </li>
                                    </>
                                )}

                                {hasFeature(
                                    user,
                                    FeatureAccess.ProgramAccess
                                ) && (
                                    <>
                                        <li>
                                            <Link to="/programs">
                                                <ULIComponent
                                                    icon={DocumentTextIcon}
                                                />
                                                Programs
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/students">
                                                <ULIComponent
                                                    icon={AcademicCapIcon}
                                                />
                                                Students
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/admins">
                                                <ULIComponent
                                                    icon={UsersIcon}
                                                />
                                                Admins
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/resources-management">
                                                <ULIComponent
                                                    icon={ArchiveBoxIcon}
                                                />
                                                Resources
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/facilities">
                                                <ULIComponent
                                                    icon={
                                                        BuildingStorefrontIcon
                                                    }
                                                />
                                                Facilities
                                            </Link>
                                        </li>
                                    </>
                                )}

                                {!hasFeature(
                                    user,
                                    FeatureAccess.ProgramAccess
                                ) &&
                                    !hasFeature(
                                        user,
                                        FeatureAccess.ProviderAccess
                                    ) &&
                                    !hasFeature(
                                        user,
                                        FeatureAccess.OpenContentAccess
                                    ) && (
                                        <>
                                            <li>
                                                <Link to="/students">
                                                    <ULIComponent
                                                        icon={AcademicCapIcon}
                                                    />
                                                    Students
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/admins">
                                                    <ULIComponent
                                                        icon={UsersIcon}
                                                    />
                                                    Admins
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/resources-management">
                                                    <ULIComponent
                                                        icon={ArchiveBoxIcon}
                                                    />
                                                    Resources
                                                </Link>
                                            </li>
                                            <li>
                                                <Link to="/facilities">
                                                    <ULIComponent
                                                        icon={
                                                            BuildingStorefrontIcon
                                                        }
                                                    />
                                                    Facilities
                                                </Link>
                                            </li>
                                        </>
                                    )}
                            </>
                        ) : (
                            <>
                                {/* student view */}
                                {hasFeature(
                                    user,
                                    FeatureAccess.OpenContentAccess
                                ) && (
                                    <>
                                        {user.feature_access.length === 1 ? (
                                            <li className="mt-16">
                                                <Link to="/open-content-dashboard">
                                                    <ULIComponent
                                                        icon={HomeIcon}
                                                    />
                                                    Dashboard
                                                </Link>
                                            </li>
                                        ) : (
                                            <li className="mt-16">
                                                <Link to="/student-activity">
                                                    <ULIComponent
                                                        icon={HomeIcon}
                                                    />
                                                    Dashboard
                                                </Link>
                                            </li>
                                        )}
                                        <li>
                                            <Link to="/open-content/libraries">
                                                <ULIComponent
                                                    icon={BookOpenIcon}
                                                />
                                                Open Content
                                            </Link>
                                        </li>
                                    </>
                                )}
                                {hasFeature(
                                    user,
                                    FeatureAccess.ProviderAccess
                                ) && (
                                    <>
                                        <li className="mt-16">
                                            <Link to="/student-activity">
                                                <ULIComponent icon={HomeIcon} />
                                                My Learning
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/my-courses">
                                                <ULIComponent
                                                    icon={RectangleStackIcon}
                                                />{' '}
                                                My Courses
                                            </Link>
                                        </li>
                                    </>
                                )}
                                {hasFeature(
                                    user,
                                    FeatureAccess.ProgramAccess
                                ) && (
                                    <li>
                                        <Link to="/programs">
                                            <ULIComponent
                                                icon={DocumentTextIcon}
                                            />
                                            Programs
                                        </Link>
                                    </li>
                                )}
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
                            {user && user.role === UserRole.SystemAdmin && (
                                <li>
                                    <FeatureLevelCheckboxes
                                        features={user.feature_access ?? []}
                                        setUser={setUser}
                                    />
                                </li>
                            )}
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
