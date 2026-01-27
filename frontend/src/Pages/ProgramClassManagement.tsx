import { Class, ClassMgmtTabs, ServerResponseOne, Tab } from '@/common';
import { useEffect, useState } from 'react';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useBreadcrumb } from '@/Context/BreadcrumbContext';

const tabDisplayNames: Record<string, string> = {
    dashboard: ClassMgmtTabs.CLASS,
    schedule: ClassMgmtTabs.SCHEDULE,
    enrollments: ClassMgmtTabs.ENROLLMENT,
    attendance: ClassMgmtTabs.ATTENDANCE
};

export default function ProgramClassManagement() {
    const { class_id } = useParams<{ class_id?: string }>();
    const navigate = useNavigate();
    const route = useLocation();
    const tab = route.pathname.split('/')[3] ?? 'dashboard';
    const tabOptions: Tab[] = [
        { name: ClassMgmtTabs.CLASS, value: 'dashboard' },
        { name: ClassMgmtTabs.SCHEDULE, value: 'schedule' },
        { name: ClassMgmtTabs.ENROLLMENT, value: 'enrollments' },
        { name: ClassMgmtTabs.ATTENDANCE, value: 'attendance' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === tab) ?? tabOptions[0]
    );

    const { data: classData } = useSWR<ServerResponseOne<Class>, Error>(
        `/api/program-classes/${class_id}`
    );
    const classInfo = classData?.data;
    const { setBreadcrumbItems } = useBreadcrumb();

    useEffect(() => {
        const items = [
            { label: 'Programs', href: '/programs' },
            ...(classInfo?.program
                ? [
                      {
                          label: classInfo.program.name,
                          href: `/programs/${classInfo.program.id}`
                      }
                  ]
                : []),
            ...(classInfo
                ? [
                      {
                          label: classInfo.name,
                          href: `/program-classes/${classInfo.id}/dashboard`
                      }
                  ]
                : []),
            { label: tabDisplayNames[tab] ?? 'Dashboard' }
        ];
        setBreadcrumbItems(items);

        return () => {
            setBreadcrumbItems([]);
        };
    }, [classInfo, tab, setBreadcrumbItems]);

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
