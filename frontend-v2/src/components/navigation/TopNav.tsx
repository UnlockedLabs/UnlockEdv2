import {
    useAuth,
    isAdministrator,
    canSwitchFacility,
    handleLogout,
    isFacilityAdmin
} from '@/auth/useAuth';
import { Facility } from '@/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, LogOut, CircleHelp } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

export default function TopNav({
    facilities,
    onToggleHelpCenter
}: {
    facilities?: Facility[];
    onToggleHelpCenter: () => void;
}) {
    const { user } = useAuth();
    const { pageTitle } = usePageTitle();

    if (!user) return null;

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
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6 shrink-0">
            <div className="flex flex-col min-w-0">
                <h1 className="text-xl text-[#203622] truncate">
                    {pageTitle}
                </h1>
                {isFacilityAdmin(user) && (
                    <span className="text-sm text-muted-foreground truncate">
                        {user.facility.name}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {canSwitchFacility(user) &&
                facilities &&
                facilities.length > 0 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                            >
                                <Building2 className="h-4 w-4" />
                                <span className="hidden sm:inline truncate max-w-[8rem]">
                                    {user.facility.name}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {facilities.map((facility) => (
                                <DropdownMenuItem
                                    key={facility.id}
                                    onClick={() => {
                                        void handleSwitchFacility(facility);
                                    }}
                                >
                                    {facility.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}

                {!isAdministrator(user) && (
                    <Button
                        variant="ghost"
                        size="sm"
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
                            className="gap-2"
                        >
                            <div className="size-7 rounded-full bg-[#556830] dark:bg-[#8fb55e] flex items-center justify-center text-white text-xs font-medium">
                                {user.name_first?.[0]}
                                {user.name_last?.[0]}
                            </div>
                            <span className="hidden sm:inline">
                                {user.name_first} {user.name_last}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
        </header>
    );
}
