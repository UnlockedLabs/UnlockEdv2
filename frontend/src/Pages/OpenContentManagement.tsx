import { OpenContentProviderType, Tab } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet } from 'react-router-dom';
import { PlusCircleIcon } from '@heroicons/react/24/solid';

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
            <div
                className="tooltip tooltip-left mt-5 pl-5 justify-self-end"
                data-tip="View as Student"
            >
                <button
                    className="btn btn-primary btn-sm text-base-teal"
                    onClick={() =>
                        navigate(`/open-content/${activeTab.value}`, {
                            replace: true
                        })
                    }
                >
                    <PlusCircleIcon className="w-4 my-auto" />
                    Student View
                </button>
            </div>
            <div className="flex flex-row gap-4 pt-8 pb-8">
                <Outlet />
            </div>
        </div>
    );
}
