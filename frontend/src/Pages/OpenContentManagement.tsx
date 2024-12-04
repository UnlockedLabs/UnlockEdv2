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
    const [activeTab, setActiveTab] = useState<Tab>(
        tab.toLowerCase() === 'libraries'
            ? {
                  name: 'Kiwix',
                  value: 'Libraries'
              }
            : { name: 'Videos', value: 'Videos' }
    );
    useEffect(() => {
        setPathVal([{ path_id: ':kind', value: activeTab.value as string }]);
    }, [activeTab]);
    const tabs = [
        { name: OpenContentProviderType.KIWIX, value: 'Libraries' },
        { name: OpenContentProviderType.VIDEOS, value: 'Videos' }
    ];

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
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={handlePageChange}
            />
            <div className="flex flex-row gap-4 pt-8 pb-8">
                <Outlet />
            </div>
        </div>
    );
}
