import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
    DepartmentMetrics,
    ServerResponseOne,
    FilterPastTime,
    Facility,
    ServerResponseMany
} from '@/types';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
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
    UsersIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    UserPlusIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import EngagementRateGraph from './EngagementRateGraph';

interface StatsCardProps {
    title: string;
    value: string;
    label: string;
    tooltip: string;
    icon: React.ReactNode;
    iconBg: string;
}

function StatsCard({ title, value, label, tooltip, icon, iconBg }: StatsCardProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="bg-card rounded-lg border border-border p-5 flex items-start gap-4">
                    <div className={`rounded-lg p-2.5 shrink-0 ${iconBg}`}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-2xl font-semibold text-foreground">
                            {value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

export default function OperationalInsightsCharts() {
    const [facility, setFacility] = useState('all');
    const [timeFilter, setTimeFilter] = useState<string>(
        FilterPastTime['Past 30 days']
    );
    const [resetCache, setResetCache] = useState(false);
    const { user } = useAuth();

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<DepartmentMetrics>
    >(
        `/api/department-metrics?facility=${facility}&days=${timeFilter}&reset=${resetCache}`
    );

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        user && canSwitchFacility(user) ? '/api/facilities' : null
    );

    useEffect(() => {
        void mutate();
    }, [facility, timeFilter, resetCache, mutate]);

    useEffect(() => {
        if (user && !canSwitchFacility(user)) {
            setFacility('');
        }
    }, [user]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
                <p className="text-red-600">Error loading operational insights data.</p>
            </div>
        );
    }

    const metrics = data?.data;
    if (!data || !metrics) return null;

    const formattedDate = new Date(metrics.last_cache).toLocaleString('en-US');
    const totalUsers = metrics.data.total_residents ?? 0;
    const activePercent =
        totalUsers > 0
            ? ((metrics.data.active_users / totalUsers) * 100).toFixed(1)
            : '0';
    const inactiveUsers = totalUsers - metrics.data.active_users;
    const timeLabel =
        timeFilter === 'all' ? 'all time' : `the last ${timeFilter} days`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div className="flex flex-row gap-4">
                    <div>
                        <label className="text-sm text-muted-foreground mb-1 block">
                            Time Period
                        </label>
                        <Select
                            value={timeFilter}
                            onValueChange={setTimeFilter}
                        >
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">Past 30 days</SelectItem>
                                <SelectItem value="90">Past 90 days</SelectItem>
                                <SelectItem value="all">All time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {user && canSwitchFacility(user) && (
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">
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
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">
                        Last updated: {formattedDate}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetCache(!resetCache)}
                        className="text-foreground border-border"
                    >
                        <ArrowPathIcon className="size-4 mr-1" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatsCard
                    title="Total Users"
                    value={totalUsers.toLocaleString()}
                    label="Residents"
                    tooltip="Total number of residents in the facility"
                    icon={<UsersIcon className="size-5 text-white" />}
                    iconBg="bg-[#203622]"
                />
                <StatsCard
                    title="Active Users"
                    value={metrics.data.active_users.toLocaleString()}
                    label={`${activePercent}% of total`}
                    tooltip={`Users who have logged in during ${timeLabel}`}
                    icon={<ArrowTrendingUpIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                />
                <StatsCard
                    title="Inactive Users"
                    value={inactiveUsers.toLocaleString()}
                    label={inactiveUsers === 1 ? 'User' : 'Users'}
                    tooltip={`Users who have not logged in during ${timeLabel}`}
                    icon={
                        <ArrowTrendingDownIcon className="size-5 text-white" />
                    }
                    iconBg="bg-muted0"
                />
                <StatsCard
                    title="New Users Added"
                    value={metrics.data.new_residents_added.toLocaleString()}
                    label={
                        metrics.data.new_residents_added === 1
                            ? 'User'
                            : 'Users'
                    }
                    tooltip={`New residents added during ${timeLabel}`}
                    icon={<UserPlusIcon className="size-5 text-white" />}
                    iconBg="bg-[#F1B51C]"
                />
                <StatsCard
                    title="Total Logins"
                    value={metrics.data.total_logins.toLocaleString()}
                    label={
                        metrics.data.total_logins === 1 ? 'Login' : 'Logins'
                    }
                    tooltip={`Total login count during ${timeLabel}`}
                    icon={<ArrowTrendingUpIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                />
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    Peak Login Times
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Residents only
                </p>
                <div className="h-[280px]">
                    <EngagementRateGraph
                        data={metrics.data.peak_login_times || []}
                        viewType="peakLogin"
                    />
                </div>
            </div>
        </div>
    );
}
