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
import { XIcon } from 'lucide-react';
import { FAQContent } from '@/pages/FAQs';

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
    const isDashboard = location.pathname.startsWith('/dashboard');
    const isProgramsList = location.pathname === '/programs';
    const isFacilities = location.pathname === '/facilities';
    const isFullBleed =
        isProgramDetail || isResidentProfile || isClassDetail || isEventAttendance || isClassesPage || isDashboard || isProgramsList || isFacilities;
    const fullBleedWrapperClass =
        isDashboard || isProgramsList || isFacilities || isProgramDetail || isResidentProfile || isClassDetail || isClassesPage ? 'py-0' : 'py-4';
    const showBreadcrumbs = breadcrumbItems.length > 0 && !isProgramDetail && !isResidentProfile;
    const isFacilityView =
        isProgramDetail &&
        user !== undefined &&
        canSwitchFacility(user) &&
        new URLSearchParams(location.search).has('facility_id');

    useEffect(() => {
        if (!user) return;
        if (isProgramDetail) {
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

    const needsGrayBg = isResidentProfile || isClassesPage || (isProgramDetail && canSwitchFacility(user));
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

            <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
                <div className="flex items-center shrink-0 h-16 border-b border-border">
                    <div className="md:hidden px-2">
                        <MobileNav />
                    </div>
                    <div className="flex-1">
                        <TopNav
                            facilities={facilities}
                        />
                    </div>
                </div>

                <TitleManager />
                <UnlockEdTour />
                <Toaster />

                <div className={`flex min-w-0 flex-1 overflow-hidden overflow-y-auto`}>
                    <div className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${helpCenterOpen ? 'max-w-[calc(100%-20rem)]' : ''}`}>
                        <div className={contentClass}>
                            {isFullBleed ? (
                                isClassDetail || isEventAttendance ? (
                                    <Outlet />
                                ) : (
                                    <div className={`${fullBleedWrapperClass} h-full`}>
                                        {showBreadcrumbs && (
                                            <div className="max-w-7xl mx-auto px-6 mb-4">
                                                <Breadcrumbs items={breadcrumbItems} />
                                            </div>
                                        )}
                                        <Outlet />
                                    </div>
                                )
                            ) : (
                                <div className="max-w-7xl mx-auto px-6 py-4">
                                    {showBreadcrumbs && (
                                        <div className="mb-4">
                                            <Breadcrumbs items={breadcrumbItems} />
                                        </div>
                                    )}
                                    <Outlet />
                                </div>
                            )}
                        </div>
                    </div>

                    {helpCenterOpen && (
                        <div className="w-80 shrink-0 bg-background border-l border-border animate-in slide-in-from-right duration-300 flex flex-col sticky top-0 h-[calc(100vh-4rem)]">
                            <div className="p-4 shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
                                    <button
                                        onClick={() => setHelpCenterOpen(false)}
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label="Close help center"
                                    >
                                        <XIcon className="size-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4 flex flex-col justify-center">
                                <FAQContent compact />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
