import { useAuth, handleLogout, isFacilityAdmin } from '@/auth/useAuth';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { usePageTitle } from '@/contexts/usePageTitle';

export default function TopNav() {
    const { user } = useAuth();
    const { pageTitle } = usePageTitle();

    if (!user) return null;

    return (
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6 shrink-0">
            <div className="flex flex-col min-w-0">
                <h1 className="text-xl text-brand-dark truncate">
                    {pageTitle}
                </h1>
                {isFacilityAdmin(user) && (
                    <span className="text-sm text-muted-foreground truncate">
                        {user.facility.name}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                            <div className="size-7 rounded-full bg-brand dark:bg-[#8fb55e] flex items-center justify-center text-white text-xs font-medium">
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
