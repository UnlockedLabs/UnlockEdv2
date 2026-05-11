import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_TRIGGER_CLASS =
    'data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted px-4 py-2.5 rounded-lg transition-all duration-200';

const TAB_OPTIONS = [
    { name: 'Schedule', value: 'schedule' },
    { name: 'Enrollment', value: 'enrollments' },
    { name: 'Attendance', value: 'attendance' }
];

function getTabFromPath(pathname: string): string {
    const parts = pathname.split('/');
    const tabSegment = parts[3];
    return TAB_OPTIONS.find((t) => t.value === tabSegment)?.value ?? 'enrollments';
}

export default function ProgramClassManagement() {
    const { class_id } = useParams<{ class_id?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(
        getTabFromPath(location.pathname)
    );

    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
    }, [location.pathname]);

    function handleTabChange(value: string) {
        setActiveTab(value);
        navigate(`${class_id}/${value}`);
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="bg-card border border-border p-1 h-auto gap-1">
                    {TAB_OPTIONS.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className={TAB_TRIGGER_CLASS}
                        >
                            {tab.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <Outlet />
        </div>
    );
}
