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
import HelpCenter from '@/pages/HelpCenter';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { useBreadcrumbsFromRoutes } from '@/hooks/useBreadcrumbsFromRoutes';
import { resolveTitle } from '@/loaders/routeLoaders';

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
    const isResidentProfile = /^\/residents\/\w+$/.test(location.pathname);
    const isClassDetail = /^\/program-classes\/\d+\/detail$/.test(location.pathname);
    const isEventAttendance = /^\/program-classes\/\d+\/events\/\d+\/attendance\//.test(location.pathname);
    const isClassesPage = location.pathname === '/classes';
    const isResidentsPage = location.pathname === '/residents';
    const isDashboard = location.pathname.startsWith('/dashboard');
    const isProgramsList = location.pathname === '/programs';
    const isFacilities = location.pathname === '/facilities';
    const isKnowledgeCenter = location.pathname === '/knowledge-center-management' || location.pathname === '/knowledge-center';
    const isContentViewer = location.pathname.startsWith('/viewer/');
    const isResidentPage = ['/learning-path', '/my-courses', '/my-progress', '/resident-programs', '/home'].includes(location.pathname);
    const isFullBleed =
        isProgramDetail || isResidentProfile || isResidentsPage || isClassDetail || isEventAttendance || isClassesPage || isDashboard || isProgramsList || isFacilities || isKnowledgeCenter || isContentViewer || isResidentPage;
    const fullBleedWrapperClass =
        isDashboard || isProgramsList || isFacilities || isProgramDetail || isResidentProfile || isResidentsPage || isClassDetail || isClassesPage || isKnowledgeCenter || isContentViewer || isResidentPage ? 'py-0' : 'py-4';
    const showBreadcrumbs = breadcrumbItems.length > 0 && !isProgramDetail && !isResidentProfile && !isContentViewer;
    const isFacilityView =
        isProgramDetail &&
        user !== undefined &&
        canSwitchFacility(user) &&
        new URLSearchParams(location.search).has('facility_id');

    useEffect(() => {
        if (!user) return;
        if (isContentViewer) {
            setPageTitle('');
        } else if (isProgramDetail) {
            if (isFacilityView) {
                setPageTitle('');
            } else if (canSwitchFacility(user)) {
                setPageTitle('Statewide Program View');
            } else {
                setPageTitle('Program Details');
            }
        } else if (pageTitle) {
            setPageTitle(pageTitle);
        }
    }, [isFacilityView, isProgramDetail, pageTitle, setPageTitle, user]);

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

    const needsGrayBg = isResidentProfile || isResidentsPage || isClassesPage || isKnowledgeCenter || (isProgramDetail && canSwitchFacility(user));
    const rootClass = 'h-screen bg-background flex overflow-hidden';
    const contentClass = `flex-1 overflow-y-auto overflow-x-hidden ${needsGrayBg ? 'bg-[#E2E7EA]' : ''}`;

    return (
        <div className={rootClass}>
            <div className="hidden md:flex">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() =>
                        setSidebarCollapsed(!sidebarCollapsed)
                    }
                    onToggleHelpCenter={() =>
                        setHelpCenterOpen(!helpCenterOpen)
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

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        className={`${contentClass} transition-all duration-100 ease-in-out flex-1 min-w-0`}
                    >
                        {isFullBleed ? (
                            isClassDetail || isEventAttendance ? (
                                <Outlet />
                            ) : (
                                <div
                                    className={`${fullBleedWrapperClass} h-full`}
                                >
                                    {showBreadcrumbs && (
                                        <div className="max-w-7xl mx-auto px-6 mb-4">
                                            <Breadcrumbs
                                                items={breadcrumbItems}
                                            />
                                        </div>
                                    )}
                                    <Outlet />
                                </div>
                            )
                        ) : (
                            <div className="max-w-7xl mx-auto px-6 py-4">
                                {showBreadcrumbs && (
                                    <div className="mb-4">
                                        <Breadcrumbs
                                            items={breadcrumbItems}
                                        />
                                    </div>
                                )}
                                <Outlet />
                            </div>
                        )}
                    </div>
                    {helpCenterOpen && (
                        <div className="w-80 bg-muted p-4 shadow-lg overflow-y-auto shrink-0">
                            <HelpCenter
                                close={() => setHelpCenterOpen(false)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
