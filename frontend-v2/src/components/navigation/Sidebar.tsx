import { Link, useLocation } from 'react-router-dom';
import {
    useAuth,
    isAdministrator,
    hasFeature,
    canSwitchFacility
} from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import Brand from '@/components/Brand';
import {
    HomeIcon,
    AcademicCapIcon,
    RectangleStackIcon,
    UsersIcon,
    UserGroupIcon,
    BookOpenIcon,
    ChartBarIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    LightBulbIcon,
    GlobeAltIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ArrowPathIcon,
    BookmarkIcon,
    TrophyIcon,
    RocketLaunchIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
    onNavigate?: () => void;
}

export default function Sidebar({
    collapsed,
    onToggleCollapse,
    onNavigate
}: SidebarProps) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) return null;

    const isActive = (paths: string[]) =>
        paths.some((p) => location.pathname.startsWith(p));

    return (
        <div
            className={cn(
                'bg-background border-r border-border transition-all duration-300 flex flex-col h-full',
                collapsed ? 'w-20' : 'w-64'
            )}
        >
            <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0">
                {!collapsed && <Brand />}
                <button
                    onClick={onToggleCollapse}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    aria-label={
                        collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                    }
                >
                    <ChevronRightIcon
                        className={cn(
                            'size-5 text-muted-foreground transition-transform',
                            !collapsed && 'rotate-180'
                        )}
                    />
                </button>
            </div>

            <nav className="p-3 space-y-1 overflow-y-auto flex-1">
                {isAdministrator(user) ? (
                    <AdminNav
                        collapsed={collapsed}
                        isActive={isActive}
                        onNavigate={onNavigate}
                    />
                ) : (
                    <StudentNav
                        collapsed={collapsed}
                        isActive={isActive}
                        onNavigate={onNavigate}
                    />
                )}
            </nav>
        </div>
    );
}

interface NavSectionProps {
    collapsed: boolean;
    isActive: (paths: string[]) => boolean;
    onNavigate?: () => void;
}

function AdminNav({ collapsed, isActive, onNavigate }: NavSectionProps) {
    const { user } = useAuth();
    if (!user) return null;

    return (
        <>
            <NavLink
                to="/dashboard"
                icon={HomeIcon}
                label="Dashboard"
                active={isActive(['/dashboard'])}
                collapsed={collapsed}
                onClick={onNavigate}
            />

            <SectionHeader label="Core" collapsed={collapsed} />

            <NavLink
                to="/residents"
                icon={UsersIcon}
                label="Residents"
                active={isActive(['/residents'])}
                collapsed={collapsed}
                onClick={onNavigate}
            />
            {canSwitchFacility(user) && (
                <>
                    <NavLink
                        to="/admins"
                        icon={UserGroupIcon}
                        label="Admins"
                        active={isActive(['/admins'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                    <NavLink
                        to="/facilities"
                        icon={BuildingOfficeIcon}
                        label="Facilities"
                        active={isActive(['/facilities'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                </>
            )}
            <NavLink
                to="/operational-insights"
                icon={ChartBarIcon}
                label="Operational Insights"
                active={isActive(['/operational-insights'])}
                collapsed={collapsed}
                onClick={onNavigate}
            />

            {hasFeature(user, FeatureAccess.ProgramAccess) && (
                <CollapsibleSection
                    id="program-management"
                    label="Program Management"
                    icon={AcademicCapIcon}
                    collapsed={collapsed}
                    isActive={isActive([
                        '/programs',
                        '/program-classes',
                        '/classes',
                        '/schedule'
                    ])}
                    onNavigate={onNavigate}
                    items={[
                        {
                            to: '/programs',
                            icon: RectangleStackIcon,
                            label: 'Programs',
                            active: isActive(['/programs', '/program-classes'])
                        },
                        {
                            to: '/classes',
                            icon: AcademicCapIcon,
                            label: 'Classes',
                            active: isActive(['/classes'])
                        },
                        {
                            to: '/schedule',
                            icon: CalendarIcon,
                            label: 'Schedule',
                            active: isActive(['/schedule'])
                        }
                    ]}
                />
            )}

            {(hasFeature(user, FeatureAccess.ProviderAccess) ||
                hasFeature(user, FeatureAccess.OpenContentAccess)) && (
                <CollapsibleSection
                    id="connected-learning"
                    label="Connected Learning"
                    icon={GlobeAltIcon}
                    collapsed={collapsed}
                    isActive={isActive([
                        '/learning-insights',
                        '/learning-platforms'
                    ])}
                    onNavigate={onNavigate}
                    items={[
                        ...(hasFeature(user, FeatureAccess.ProviderAccess)
                            ? [
                                  {
                                      to: '/learning-insights',
                                      icon: LightBulbIcon,
                                      label: 'Learning Insights',
                                      active: isActive(['/learning-insights'])
                                  }
                              ]
                            : []),
                        ...(hasFeature(user, FeatureAccess.ProviderAccess) &&
                        canSwitchFacility(user)
                            ? [
                                  {
                                      to: '/learning-platforms',
                                      icon: GlobeAltIcon,
                                      label: 'Learning Platforms',
                                      active: isActive(['/learning-platforms'])
                                  }
                              ]
                            : [])
                    ]}
                />
            )}

            {hasFeature(user, FeatureAccess.OpenContentAccess) && (
                <CollapsibleSection
                    id="knowledge-center"
                    label="Knowledge Center"
                    icon={BookOpenIcon}
                    collapsed={collapsed}
                    isActive={isActive([
                        '/knowledge-center-management'
                    ])}
                    onNavigate={onNavigate}
                    items={[
                        {
                            to: '/knowledge-center-management',
                            icon: BookOpenIcon,
                            label: 'Knowledge Center',
                            active: isActive(['/knowledge-center-management'])
                        }
                    ]}
                />
            )}
        </>
    );
}

function StudentNav({ collapsed, isActive, onNavigate }: NavSectionProps) {
    const { user } = useAuth();
    if (!user) return null;

    const hasOpen = hasFeature(user, FeatureAccess.OpenContentAccess);
    const hasProvider = hasFeature(user, FeatureAccess.ProviderAccess);
    const hasProgram = hasFeature(user, FeatureAccess.ProgramAccess);

    return (
        <>
            {hasOpen ? (
                <NavLink
                    to="/home"
                    icon={HomeIcon}
                    label="Home"
                    active={isActive(['/home'])}
                    collapsed={collapsed}
                    onClick={onNavigate}
                />
            ) : (
                !hasProvider &&
                !hasProgram && (
                    <NavLink
                        to="/temp-home"
                        icon={HomeIcon}
                        label="Home"
                        active={isActive(['/temp-home'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                )
            )}
            {hasOpen && (
                <NavLink
                    to="/knowledge-center"
                    icon={BookOpenIcon}
                    label="Knowledge Center"
                    active={isActive(['/knowledge-center'])}
                    collapsed={collapsed}
                    onClick={onNavigate}
                />
            )}
            {hasProvider && (
                <>
                    <NavLink
                        to="/learning-path"
                        icon={RocketLaunchIcon}
                        label="Learning Path"
                        active={isActive(['/learning-path'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                    <NavLink
                        to="/my-courses"
                        icon={BookmarkIcon}
                        label="My Courses"
                        active={isActive(['/my-courses'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                    <NavLink
                        to="/my-progress"
                        icon={TrophyIcon}
                        label="My Progress"
                        active={isActive(['/my-progress'])}
                        collapsed={collapsed}
                        onClick={onNavigate}
                    />
                </>
            )}
            {hasProgram && (
                <NavLink
                    to="/resident-programs"
                    icon={ArrowPathIcon}
                    label="Programs"
                    active={isActive(['/resident-programs'])}
                    collapsed={collapsed}
                    onClick={onNavigate}
                />
            )}
        </>
    );
}

function SectionHeader({
    label,
    collapsed
}: {
    label: string;
    collapsed: boolean;
}) {
    if (collapsed) return <div className="border-t border-border my-3" />;
    return (
        <div className="pt-4 pb-2 px-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

interface NavLinkProps {
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    active: boolean;
    collapsed: boolean;
    onClick?: () => void;
}

function NavLink({
    to,
    icon: Icon,
    label,
    active,
    collapsed,
    onClick
}: NavLinkProps) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                active
                    ? 'bg-[#556830] text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-accent'
            )}
        >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">{label}</span>}
        </Link>
    );
}

interface CollapsibleItem {
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    active: boolean;
}

interface CollapsibleSectionProps {
    id: string;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    collapsed: boolean;
    isActive: boolean;
    items: CollapsibleItem[];
    onNavigate?: () => void;
}

function CollapsibleSection({
    id,
    label,
    icon: Icon,
    collapsed,
    isActive,
    items,
    onNavigate
}: CollapsibleSectionProps) {
    const [expanded, setExpanded] = useState(isActive);

    if (items.length === 0) return null;

    return (
        <div>
            {!collapsed && (
                <div className="pt-4 pb-2 px-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {label}
                    </div>
                </div>
            )}
            {collapsed && <div className="border-t border-border my-3" />}

            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive
                        ? 'text-[#556830] dark:text-[#8fb55e]'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-accent'
                )}
            >
                <Icon className="size-5 shrink-0" />
                {!collapsed && (
                    <>
                        <span className="text-sm flex-1 text-left">
                            {label}
                        </span>
                        <ChevronDownIcon
                            className={cn(
                                'size-4 transition-transform',
                                expanded && 'rotate-180'
                            )}
                        />
                    </>
                )}
            </button>
            {!collapsed && expanded && (
                <div className="ml-4 mt-1 space-y-1 pl-3 border-l-2 border-border">
                    {items.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                                item.active
                                    ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-accent'
                            )}
                        >
                            <item.icon className="size-4 shrink-0" />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
