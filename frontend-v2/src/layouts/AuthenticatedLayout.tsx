import { Outlet, useMatches } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Facility, RouteTitleHandler, TitleHandler } from '@/types';
import { useAuth, isAdministrator, canSwitchFacility } from '@/auth/useAuth';
import API from '@/api/api';
import TopNav from '@/components/navigation/TopNav';
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
    const matches = useMatches();
    const currentRoute = matches[matches.length - 1];
    const routeData = currentRoute?.data as TitleHandler;
    const routeHandle = currentRoute?.handle as RouteTitleHandler<TitleHandler>;
    const pageTitle = resolveTitle(routeHandle, routeData);
    const { setPageTitle } = usePageTitle();
    const { breadcrumbItems: contextBreadcrumbs } = useBreadcrumb();
    const routeBreadcrumbs = useBreadcrumbsFromRoutes();
    const breadcrumbItems =
        routeBreadcrumbs.length > 0 ? routeBreadcrumbs : contextBreadcrumbs;

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

    return (
        <div className="min-h-screen bg-background">
            <TopNav
                facilities={facilities}
                onToggleHelpCenter={() => setHelpCenterOpen(!helpCenterOpen)}
            />
            <TitleManager />
            <UnlockEdTour />
            <Toaster />

            <div className="px-6 py-4">
                {breadcrumbItems.length > 0 && (
                    <div className="mb-4">
                        <Breadcrumbs items={breadcrumbItems} />
                    </div>
                )}
                <Outlet />
            </div>
        </div>
    );
}
