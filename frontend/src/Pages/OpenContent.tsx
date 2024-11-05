import { OpenContentProviderType, UserRole, Tab } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/useAuth';
import { PlusCircleIcon } from '@heroicons/react/24/solid';

export default function OpenContent() {
    const { setPathVal } = usePathValue();
    const navigate = useNavigate();
    const { user } = useAuth();
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
        navigate(`/open-content/${tab.value}`);
    };

    return (
        <div className="px-8 pb-4">
            <h1>Open Content</h1>
            <TabView
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={handlePageChange}
            />
            {user?.role === UserRole.Admin && (
                <div
                    className="tooltip tooltip-left mt-5 pl-5 justify-self-end"
                    data-tip="View as Administrator"
                >
                    <button
                        className="btn btn-primary btn-sm text-base-teal"
                        onClick={() =>
                            navigate(
                                `/open-content-management/${activeTab.value}`
                            )
                        }
                    >
                        <PlusCircleIcon className="w-4 my-auto" />
                        Admin View
                    </button>
                </div>
            )}
            <div className="flex flex-row gap-4 pt-8 pb-8">
                <Outlet />
            </div>
        </div>
    );
}
