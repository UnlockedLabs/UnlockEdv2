import { Link, useLocation } from 'react-router-dom';
import {
    useAuth,
    isAdministrator,
    hasFeature,
    canSwitchFacility
} from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import Brand from '@/components/Brand';

interface MobileNavItem {
    label: string;
    to: string;
}

export default function MobileNav() {
    const { user } = useAuth();
    const location = useLocation();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    const items: MobileNavItem[] = [];

    if (isAdministrator(user)) {
        if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
            items.push({ label: 'Knowledge Insights', to: '/knowledge-insights' });
        }
        if (hasFeature(user, FeatureAccess.ProviderAccess)) {
            items.push({ label: 'Learning Insights', to: '/learning-insights' });
        }
        items.push({ label: 'Operational Insights', to: '/operational-insights' });
        if (hasFeature(user, FeatureAccess.ProgramAccess)) {
            items.push({ label: 'Programs', to: '/programs' });
            items.push({ label: 'Schedule', to: '/schedule' });
        }
        items.push({ label: 'Residents', to: '/residents' });
        if (canSwitchFacility(user)) {
            items.push({ label: 'Admins', to: '/admins' });
            items.push({ label: 'Facilities', to: '/facilities' });
        }
        if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
            items.push({ label: 'Knowledge Center', to: '/knowledge-center-management/libraries' });
        }
    } else {
        if (hasFeature(user, FeatureAccess.OpenContentAccess)) {
            items.push({ label: 'Home', to: '/home' });
            items.push({ label: 'Knowledge Center', to: '/knowledge-center/libraries' });
        }
        if (hasFeature(user, FeatureAccess.ProviderAccess)) {
            items.push({ label: 'Learning Path', to: '/learning-path' });
            items.push({ label: 'My Courses', to: '/my-courses' });
            items.push({ label: 'My Progress', to: '/my-progress' });
        }
        if (hasFeature(user, FeatureAccess.ProgramAccess)) {
            items.push({ label: 'Programs', to: '/resident-programs' });
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden text-white hover:bg-[#556830]/50"
                >
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-[#203622] border-[#556830] p-0">
                <div className="p-4 border-b border-[#556830]">
                    <Brand />
                </div>
                <nav className="flex flex-col gap-1 p-4">
                    {items.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpen(false)}
                            className={cn(
                                'px-3 py-2 rounded text-sm transition-colors',
                                location.pathname.startsWith(item.to)
                                    ? 'bg-[#556830] text-white'
                                    : 'text-muted-foreground hover:text-white hover:bg-[#556830]/50'
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    );
}
