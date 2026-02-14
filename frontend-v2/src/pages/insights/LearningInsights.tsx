import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
    AdminLayer2Join,
    Facility,
    LearningInsight,
    ServerResponseOne,
    ServerResponseMany
} from '@/types';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BookOpenIcon,
    UsersIcon,
    ClockIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface MetricCardProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string;
    subtitle: string;
    tooltip: string;
}

function MetricCard({ icon, iconBg, label, value, subtitle, tooltip }: MetricCardProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4">
                    <div className={`rounded-lg p-2.5 shrink-0 ${iconBg}`}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className="text-2xl font-semibold text-[#203622]">
                            {value}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {subtitle}
                        </p>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

const insightColumns: Column<LearningInsight>[] = [
    {
        key: 'course_name',
        header: 'Course Name',
        render: (item) => (
            <span className="font-medium text-[#203622]">
                {item.course_name}
            </span>
        )
    },
    {
        key: 'enrolled',
        header: 'Students Enrolled',
        render: (item) => item.total_students_enrolled.toLocaleString(),
        headerClassName: 'text-center',
        className: 'text-center'
    },
    {
        key: 'completed',
        header: 'Students Completed',
        render: (item) => item.total_students_completed.toLocaleString(),
        headerClassName: 'text-center',
        className: 'text-center'
    },
    {
        key: 'completion_rate',
        header: 'Completion Rate',
        render: (item) => `${item.completion_rate.toFixed(1)}%`,
        headerClassName: 'text-center',
        className: 'text-center'
    },
    {
        key: 'activity_hours',
        header: 'Activity Hours',
        render: (item) => item.activity_hours.toLocaleString('en-US'),
        headerClassName: 'text-right',
        className: 'text-right'
    }
];

export default function LearningInsights() {
    const { user } = useAuth();
    const [facility, setFacility] = useState('all');
    const [resetCache, setResetCache] = useState(false);

    const { data, error, isLoading } = useSWR<
        ServerResponseOne<AdminLayer2Join>
    >(
        user
            ? `/api/users/${user.id}/admin-layer2?facility=${facility}&reset=${resetCache}`
            : null
    );

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        user && canSwitchFacility(user) ? '/api/facilities' : null
    );

    useEffect(() => {
        if (user && !canSwitchFacility(user)) {
            setFacility('');
        }
    }, [user]);

    if (!user) return null;

    if (isLoading) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-lg" />
                        ))}
                    </div>
                    <Skeleton className="h-96 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                        <p className="text-red-600">
                            Error loading learning insights data.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const layer2 = data?.data;
    if (!layer2) return null;

    const formattedDate = new Date(layer2.last_cache).toLocaleString('en-US');
    const insights = layer2.data.learning_insights ?? [];

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                    <PageHeader
                        title="Learning Insights"
                        subtitle="Course engagement and student progress"
                    />
                    <div className="flex items-end gap-4">
                        {canSwitchFacility(user) && (
                            <div>
                                <label className="text-sm text-gray-500 mb-1 block">
                                    Facility
                                </label>
                                <Select
                                    value={facility}
                                    onValueChange={setFacility}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Facilities
                                        </SelectItem>
                                        {facilitiesResp?.data?.map((f) => (
                                            <SelectItem
                                                key={f.id}
                                                value={String(f.id)}
                                            >
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">
                                Last updated: {formattedDate}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setResetCache(!resetCache)}
                                className="text-[#203622] border-gray-200"
                            >
                                <ArrowPathIcon className="size-4 mr-1" />
                                Refresh Data
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MetricCard
                        icon={<BookOpenIcon className="size-5 text-white" />}
                        iconBg="bg-[#556830]"
                        label="Total Courses Offered"
                        value={layer2.data.total_courses_offered.toLocaleString()}
                        subtitle="Courses"
                        tooltip="Total number of courses available across all providers"
                    />
                    <MetricCard
                        icon={<UsersIcon className="size-5 text-white" />}
                        iconBg="bg-[#203622]"
                        label="Total Students Enrolled"
                        value={layer2.data.total_students_enrolled.toLocaleString()}
                        subtitle="Students"
                        tooltip="Total students currently enrolled in courses"
                    />
                    <MetricCard
                        icon={<ClockIcon className="size-5 text-white" />}
                        iconBg="bg-[#F1B51C]"
                        label="Total Activity Time"
                        value={layer2.data.total_hourly_activity.toLocaleString()}
                        subtitle="Hours"
                        tooltip="Total hours of student activity across all courses"
                    />
                </div>

                <DataTable
                    columns={insightColumns}
                    data={insights}
                    keyExtractor={(item) => item.course_name}
                    emptyMessage="No course data available."
                />
            </div>
        </div>
    );
}
