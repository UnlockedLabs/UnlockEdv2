import { Outlet, useLocation, useMatches } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Facility, RouteTitleHandler, TitleHandler } from '@/types';
import { useAuth, isAdministrator, canSwitchFacility } from '@/auth/useAuth';
import API from '@/api/api';
import TopNav from '@/components/navigation/TopNav';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { TitleManager } from '@/components/TitleManager';
import UnlockEdTour from '@/components/UnlockEdTour';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { useBreadcrumbsFromRoutes } from '@/hooks/useBreadcrumbsFromRoutes';
import { resolveTitle } from '@/loaders/routeLoaders';
import { Toaster } from '@/components/ui/sonner';
import WebsocketSession from '@/session/websocket';

export default function AuthenticatedLayout() {
    const { user } = useAuth();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [helpCenterOpen, setHelpCenterOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const matches = useMatches();
    const location = useLocation();
    const currentRoute = matches[matches.length - 1];
    const routeData = currentRoute?.data as TitleHandler;
    const routeHandle = currentRoute?.handle as RouteTitleHandler<TitleHandler>;
    const pageTitle = resolveTitle(routeHandle, routeData);
    const { setPageTitle } = usePageTitle();
    const { breadcrumbItems: contextBreadcrumbs } = useBreadcrumb();
    const routeBreadcrumbs = useBreadcrumbsFromRoutes();
    const breadcrumbItems =
        routeBreadcrumbs.length > 0 ? routeBreadcrumbs : contextBreadcrumbs;
    const isProgramDetail = /^\/programs\/\d+$/.test(location.pathname);
    const isDashboard = location.pathname.startsWith('/dashboard');
    const isProgramsList = location.pathname === '/programs';
    const isFullBleed = isProgramDetail || isDashboard || isProgramsList;
    const fullBleedWrapperClass = isDashboard || isProgramsList ? 'py-0' : 'py-4';

    useEffect(() => {
        if (pageTitle) {
            setPageTitle(pageTitle);
        }
    }, [pageTitle, setPageTitle]);

    useEffect(() => {
        if (user && canSwitchFacility(user)) {
            void (async () => {
                const resp = await API.get<Facility>('facilities');
                if (resp.success && Array.isArray(resp.data)) {
                    setFacilities(resp.data);
                }
            })();
        }
    }, [user]);

    useEffect(() => {
        if (user && !isAdministrator(user)) {
            const ws = new WebsocketSession(user);
            ws.connect();
            window.websocket = ws;
            return () => {
                ws.tearDownConnection(true);
            };
        }
    }, [user]);

    if (!user) return null;

    const rootClass = isProgramDetail
        ? 'min-h-screen bg-background flex'
        : 'h-screen bg-background flex overflow-hidden';
    const contentClass = isProgramDetail
        ? 'flex-1 overflow-x-hidden'
        : 'flex-1 overflow-y-auto overflow-x-hidden';

    return (
        <div className={rootClass}>
            <div className="hidden md:flex">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() =>
                        setSidebarCollapsed(!sidebarCollapsed)
                    }
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center">
                    <div className="md:hidden px-2">
                        <MobileNav />
                    </div>
                    <div className="flex-1">
                        <TopNav
                            facilities={facilities}
                            onToggleHelpCenter={() =>
                                setHelpCenterOpen(!helpCenterOpen)
                            }
                        />
                    </div>
                </div>

                <TitleManager />
                <UnlockEdTour />
                <Toaster />

                <div className={contentClass}>
                    {isFullBleed ? (
                        <div className={fullBleedWrapperClass}>
                            {breadcrumbItems.length > 0 && (
                                <div className="max-w-7xl mx-auto px-6 mt-2 mb-4">
                                    <Breadcrumbs items={breadcrumbItems} />
                                </div>
                            )}
                            <Outlet />
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto px-6 py-4">
                            {breadcrumbItems.length > 0 && (
                                <div className="mb-4">
                                    <Breadcrumbs items={breadcrumbItems} />
                                </div>
                            )}
                            <Outlet />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
