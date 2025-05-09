import { OpenContentTabs, Tab } from '@/common';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

export default function OpenContentManagement() {
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const route = useLocation();
    const tab = route.pathname.split('/')[2] ?? 'libraries';
    const tabOptions: Tab[] = [
        { name: OpenContentTabs.KIWIX, value: 'libraries' },
        { name: OpenContentTabs.VIDEOS, value: 'videos' },
        { name: OpenContentTabs.LINKS, value: 'helpful-links' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === tab) ?? tabOptions[0]
    );

    useEffect(() => {
        setAuthLayoutPageTitle(activeTab.value as string);
    }, [activeTab]);

    const handlePageChange = (tab: Tab) => {
        navigate(`/knowledge-center-management/${tab.value}`);
        setActiveTab(tab);
    };

    function navigateToStudentView() {
        navigate(`/knowledge-center/${activeTab.value}`);
    }
    const getTabFromPath = (pathname: string) =>
        tabOptions.find((t) => t.value === pathname.split('/')[2]) ??
        tabOptions[0];

    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
    }, [location.pathname]);

    return (
        <div className="px-5 pb-4">
            <div className="flex flex-row justify-end">
                <button
                    className="button-outline"
                    onClick={navigateToStudentView}
                >
                    Preview Student View
                </button>
            </div>
            <TabView
                tabs={tabOptions}
                activeTab={activeTab}
                setActiveTab={handlePageChange}
            />
            <div className="flex flex-col gap-8 py-8">
                <Outlet />
            </div>
        </div>
    );
}
