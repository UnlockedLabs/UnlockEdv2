import { OpenContentProviderType, Tab } from '@/common';
import { useState, useEffect } from 'react';
import TabView from '@/Components/TabView';
import { Outlet, useNavigate } from 'react-router-dom';
import { usePathValue } from '@/Context/PathValueCtx';

export default function OpenContentManagement() {
    const { setPathVal } = usePathValue();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>({
        name: 'Kiwix',
        value: 'Libraries'
    });
    useEffect(() => {
        setPathVal([{ path_id: ':kind', value: activeTab.value as string }]);
    }, [activeTab]);

    const tabs = [
        { name: OpenContentProviderType.KIWIX, value: 'Libraries' },
        { name: OpenContentProviderType.VIDEOS, value: 'Videos' }
    ];

    const handlePageChange = (tab: Tab) => {
        setActiveTab(tab);
        navigate(`/open-content-management/${tab.value}`);
    };

    return (
        <div className="px-8 pb-4">
            <h1>Open Content Management</h1>
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
