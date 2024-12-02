import { OpenContentProviderType, Tab } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

export default function OpenContentManagement() {
    const { setPathVal } = usePathValue();
    const navigate = useNavigate();
    const route = useLocation();
    const tab = route.pathname.split('/')[2] ?? 'libraries';
    const tabOptions: Tab[] = [
        { name: OpenContentProviderType.KIWIX, value: 'libraries' },
        { name: OpenContentProviderType.VIDEOS, value: 'videos' },
        { name: OpenContentProviderType.LINKS, value: 'helpful-links' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === tab) ?? tabOptions[0]
    );
    useEffect(() => {
        setPathVal([{ path_id: ':kind', value: activeTab.value as string }]);
    }, [activeTab]);

    const handlePageChange = (tab: Tab) => {
        setActiveTab(tab);
        navigate(`/knowledge-center-management/${tab.value}`);
    };

    return (
        <div className="px-8 pb-4">
            <div className="flex flex-row justify-between">
                <h1>Knowledge Center Management</h1>
                <button
                    className="button border border-primary bg-transparent text-body-text"
                    onClick={() =>
                        navigate(`/knowledge-center/${activeTab.value}`)
                    }
                >
                    Preview Student View
                </button>
            </div>
            <TabView
                tabs={tabOptions}
                activeTab={activeTab}
                setActiveTab={handlePageChange}
            />
            <div className="flex flex-row gap-4 pt-8 pb-8">
                <Outlet />
            </div>
        </div>
    );
}
