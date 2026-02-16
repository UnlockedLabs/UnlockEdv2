import { Link, useLocation } from 'react-router-dom';
import {
    useAuth,
    isAdministrator,
    hasFeature,
    canSwitchFacility,
    handleLogout
} from '@/auth/useAuth';
import { FeatureAccess, Facility } from '@/types';
import { useTheme } from 'next-themes';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
    Building2,
    LogOut,
    Moon,
    Sun,
    CircleHelp,
    User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    label: string;
    to: string;
    matchPaths: string[];
}

function getAdminNavItems(user: NonNullable<ReturnType<typeof useAuth>['user']>): NavItem[] {
    const items: NavItem[] = [];

    if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
        items.push({
            label: 'Knowledge Insights',
            to: '/knowledge-insights',
            matchPaths: ['/knowledge-insights']
        });
    }
    if (hasFeature(user, FeatureAccess.ProviderAccess)) {
        items.push({
            label: 'Learning Insights',
            to: '/learning-insights',
            matchPaths: ['/learning-insights']
        });
    }
    items.push({
        label: 'Operational Insights',
        to: '/operational-insights',
        matchPaths: ['/operational-insights']
    });
    if (hasFeature(user, FeatureAccess.ProgramAccess)) {
        items.push({
            label: 'Classes',
            to: '/classes',
            matchPaths: ['/classes']
        });
        items.push({
            label: 'Programs',
            to: '/programs',
            matchPaths: ['/programs', '/program-classes']
        });
        items.push({
            label: 'Schedule',
            to: '/schedule',
            matchPaths: ['/schedule']
        });
    }
    items.push({
        label: 'Residents',
        to: '/residents',
        matchPaths: ['/residents']
    });
    if (canSwitchFacility(user)) {
        items.push({
            label: 'Admins',
            to: '/admins',
            matchPaths: ['/admins']
        });
        items.push({
            label: 'Facilities',
            to: '/facilities',
            matchPaths: ['/facilities']
        });
    }
    if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
        items.push({
            label: 'Knowledge Center',
            to: '/knowledge-center-management/libraries',
            matchPaths: ['/knowledge-center-management']
        });
    }
    if (hasFeature(user, FeatureAccess.ProviderAccess) && canSwitchFacility(user)) {
        items.push({
            label: 'Learning Platforms',
            to: '/learning-platforms',
            matchPaths: ['/learning-platforms']
        });
    }

    return items;
}

function getStudentNavItems(user: NonNullable<ReturnType<typeof useAuth>['user']>): NavItem[] {
    const items: NavItem[] = [];

    if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
        items.push({
            label: 'Home',
            to: '/home',
            matchPaths: ['/home']
        });
        items.push({
            label: 'Knowledge Center',
            to: '/knowledge-center/libraries',
            matchPaths: ['/knowledge-center']
        });
    } else if (
        !hasFeature(user, FeatureAccess.ProviderAccess) &&
        !hasFeature(user, FeatureAccess.ProgramAccess)
    ) {
        items.push({
            label: 'Home',
            to: '/temp-home',
            matchPaths: ['/temp-home']
        });
    }
    if (hasFeature(user, FeatureAccess.ProviderAccess)) {
        items.push({
            label: 'Learning Path',
            to: '/learning-path',
            matchPaths: ['/learning-path']
        });
        items.push({
            label: 'My Courses',
            to: '/my-courses',
            matchPaths: ['/my-courses']
        });
        items.push({
            label: 'My Progress',
            to: '/my-progress',
            matchPaths: ['/my-progress']
        });
    }
    if (hasFeature(user, FeatureAccess.ProgramAccess)) {
        items.push({
            label: 'Programs',
            to: '/resident-programs',
            matchPaths: ['/resident-programs']
        });
    }

    return items;
}

export default function TopNav({
    facilities,
    onToggleHelpCenter
}: {
    facilities?: Facility[];
    onToggleHelpCenter: () => void;
}) {
    const { user } = useAuth();
    const location = useLocation();
    const { resolvedTheme, setTheme } = useTheme();

    if (!user) return null;

    const navItems = isAdministrator(user)
        ? getAdminNavItems(user)
        : getStudentNavItems(user);

    const isActive = (item: NavItem) =>
        item.matchPaths.some((path) => location.pathname.startsWith(path));

    const handleSwitchFacility = async (facility: Facility) => {
        const API = (await import('@/api/api')).default;
        const resp = await API.put<null, object>(
            `admin/facility-context/${facility.id}`,
            {}
        );
        if (resp.success) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('page') !== null) {
                params.set('page', '1');
            }
            const paramsString =
                params.size > 0 ? '?' + params.toString() : '';
            window.location.href = window.location.pathname + paramsString;
        }
    };

    return (
        <nav className="bg-[#203622] text-white border-b border-[#556830]">
            <div className="px-6">
                <div className="flex items-center justify-between h-16 gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <Link to="/" className="flex-shrink-0">
                            <img
                                className="h-8"
                                src="/ul-logo-w.svg"
                                alt="UnlockEd"
                            />
                        </Link>
                        <div className="hidden md:flex gap-0.5 min-w-0">
                            {navItems.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={cn(
                                        'px-2 py-1.5 rounded text-sm transition-colors whitespace-nowrap',
                                        isActive(item)
                                            ? 'bg-[#556830] text-white'
                                            : 'text-muted-foreground hover:text-white hover:bg-[#556830]/50'
                                    )}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {canSwitchFacility(user) && facilities && facilities.length > 0 ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-white hover:bg-[#556830]/50 gap-2"
                                    >
                                        <Building2 className="h-4 w-4" />
                                        <span className="hidden sm:inline block truncate max-w-[8rem]">
                                            {user.facility.name}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {facilities.map((facility) => (
                                        <DropdownMenuItem
                                            key={facility.id}
                                            onClick={() => {
                                                void handleSwitchFacility(
                                                    facility
                                                );
                                            }}
                                        >
                                            {facility.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground px-3">
                                <Building2 className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                    {user.facility.name}
                                </span>
                            </div>
                        )}

                        {!isAdministrator(user) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-white hover:bg-[#556830]/50"
                                onClick={onToggleHelpCenter}
                            >
                                <CircleHelp className="h-4 w-4" />
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-white hover:bg-[#556830]/50 gap-2"
                                >
                                    <User className="h-4 w-4" />
                                    <span className="hidden sm:inline">
                                        {user.name_first} {user.name_last}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() =>
                                        setTheme(
                                            resolvedTheme === 'dark'
                                                ? 'light'
                                                : 'dark'
                                        )
                                    }
                                >
                                    {resolvedTheme === 'dark' ? (
                                        <Sun className="h-4 w-4 mr-2" />
                                    ) : (
                                        <Moon className="h-4 w-4 mr-2" />
                                    )}
                                    {resolvedTheme === 'dark'
                                        ? 'Light Mode'
                                        : 'Dark Mode'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => {
                                        void handleLogout();
                                    }}
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
