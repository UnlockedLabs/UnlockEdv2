import { OpenContentTabs, Tab } from '@/common';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { isAdministrator, useAuth } from '@/useAuth';
import { useTourContext } from '@/Context/TourContext';

export default function OpenContent() {
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();
    const currentTabValue = route.pathname.split('/')[2] ?? 'libraries';
    const tabOptions: Tab[] = [
        { name: OpenContentTabs.KIWIX, value: 'libraries' },
        { name: OpenContentTabs.VIDEOS, value: 'videos' },
        { name: OpenContentTabs.LINKS, value: 'helpful-links' },
        { name: OpenContentTabs.FAVORITES, value: 'favorites' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === currentTabValue) ?? tabOptions[0]
    );
    const { tourState, setTourState } = useTourContext();

    useEffect(() => {
        setAuthLayoutPageTitle(activeTab.value as string);
    }, [activeTab]);

    const handlePageChange = (tab: Tab) => {
        setActiveTab(tab);
        navigate(`/knowledge-center/${String(tab.value).toLowerCase()}`);
    };
    const handleReturnToAdminView = () => {
        if (currentTabValue === 'favorites') {
            navigate('/knowledge-center-management/libraries');
        } else if (
            currentTabValue === 'libraries' ||
            currentTabValue === 'videos' ||
            currentTabValue === 'helpful-links'
        ) {
            navigate('/knowledge-center-management/' + currentTabValue);
        }
    };

    useEffect(() => {
        if (tourState.tourActive) {
            setTourState({
                stepIndex: 2
            });
        }
    }, []);

    return (
        <div className="px-5 pb-4" id="knowledge-center-landing">
            <div className="flex flex-row justify-end">
                {user && isAdministrator(user) && (
                    <button
                        className="button border border-primary bg-transparent text-body-text"
                        onClick={() => handleReturnToAdminView()}
                    >
                        Return to Admin View
                    </button>
                )}
            </div>
            <div id="knowledge-center-tabs">
                <TabView
                    tabs={tabOptions}
                    activeTab={activeTab}
                    setActiveTab={(tab) => {
                        void handlePageChange(tab);
                    }}
                />
            </div>
            <div className="flex flex-col gap-8 py-8">
                <Outlet />
            </div>
        </div>
    );
}
