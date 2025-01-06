import { OpenContentTabs, Tab } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { isAdministrator, useAuth } from '@/useAuth';

export default function OpenContent() {
    const { setPathVal } = usePathValue();
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

    useEffect(() => {
        setPathVal([{ path_id: ':kind', value: activeTab.value as string }]);
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

    return (
        <div className="px-8 pb-4">
            <div className="flex flex-row justify-between">
                <h1>Knowledge Center</h1>
                {user && isAdministrator(user) && (
                    <button
                        className="button border border-primary bg-transparent text-body-text"
                        onClick={() => handleReturnToAdminView()}
                    >
                        Return to Admin View
                    </button>
                )}
            </div>
            <TabView
                tabs={tabOptions}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                    void handlePageChange(tab);
                }}
            />
            <div className="flex flex-col gap-8 py-8">
                <Outlet />
            </div>
        </div>
    );
}
