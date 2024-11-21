import { OpenContentProviderType, Tab } from '@/common';
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
    const currentTabValue =
        route.pathname.split('/')[2]?.toLowerCase() ?? 'libraries';

    const tabOptions: Record<string, Tab> = {
        libraries: { name: OpenContentProviderType.KIWIX, value: 'Libraries' },
        videos: { name: OpenContentProviderType.VIDEOS, value: 'Videos' },
        favorites: { name: 'Favorites', value: 'Favorites' }
    };

    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions[currentTabValue]
    );

    useEffect(() => {
        const newTab = tabOptions[currentTabValue] || tabOptions.libraries;
        setActiveTab(tabOptions[currentTabValue] || tabOptions.libraries);
        setPathVal([
            {
                path_id: ':kind',
                value: newTab.value as string
            }
        ]);
    }, [route.pathname]);

    const tabs: Tab[] = [
        { name: OpenContentProviderType.KIWIX, value: 'Libraries' },
        { name: OpenContentProviderType.VIDEOS, value: 'Videos' },
        { name: 'Favorites', value: 'Favorites' }
    ];

    const handlePageChange = (tab: Tab) => {
        setActiveTab(tab);
        navigate(`/open-content/${String(tab.value).toLowerCase()}`);
    };
    const handleReturnToAdminView = () => {
        if (currentTabValue === 'favorites') {
            navigate('/open-content-management/libraries');
        } else if (
            currentTabValue === 'libraries' ||
            currentTabValue === 'videos'
        ) {
            navigate('/open-content-management/' + currentTabValue);
        }
    };

    return (
        <div className="px-8 pb-4">
            <div className="flex flex-row justify-between">
                <h1>Open Content</h1>
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
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                    void handlePageChange(tab);
                }}
            />
            <div className="flex flex-row gap-4 pt-8 pb-8">
                <Outlet />
            </div>
        </div>
    );
}
