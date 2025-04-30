import { ClassMgmtTabs, Tab } from '@/common';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation, useParams } from 'react-router-dom';

export default function ProgramClassManagement() {
    const { class_id } = useParams<{ class_id?: string }>();
    const navigate = useNavigate();
    const route = useLocation();
    const tab = route.pathname.split('/')[3] ?? 'dashboard';
    const tabOptions: Tab[] = [
        { name: ClassMgmtTabs.CLASS, value: 'dashboard' },
        { name: ClassMgmtTabs.ENROLLMENT, value: 'enrollments' },
        { name: ClassMgmtTabs.ATTENDANCE, value: 'attendance' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === tab) ?? tabOptions[0]
    );
    const handlePageChange = (tab: Tab) => {
        navigate(`${class_id}/${tab.value}`);
        setActiveTab(tab);
    };
    const getTabFromPath = (pathname: string) => {
        return (
            tabOptions.find((t) => t.value === pathname.split('/')[3]) ??
            tabOptions[0]
        );
    };
    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
    }, [location.pathname]);
    return (
        <div className="px-5 pb-4">
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
