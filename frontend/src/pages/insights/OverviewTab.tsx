import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    UsersIcon,
    UserPlusIcon,
    ArrowTrendingUpIcon,
    ChartBarIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { ArrowsUpDownIcon } from '@heroicons/react/24/solid';
import {
    DepartmentMetrics,
    DailyLoginCount,
    FacilityEngagement,
    ServerResponseOne
} from '@/types';
import API from '@/api/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import LoginTrendChart from '@/components/charts/LoginTrendChart';
import { MetricCard } from './MetricCard';
import { InsightsDateParams, priorParams, dateQuery } from './insightsRange';

interface OverviewTabProps {
    dateParams: InsightsDateParams;
    selectedFacility: string;
    canSwitch: boolean;
    rangeLabel: string;
}

type SortKey =
    | 'facility_name'
    | 'registered'
    | 'active'
    | 'logins'
    | 'avgPerActive'
    | 'activation';

interface ComparisonRow extends FacilityEngagement {
    avgPerActive: number;
    activation: number;
}

function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function ratio(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 10) / 10 : 0;
}

function changePct(current: number, prior: number): number {
    return prior > 0 ? Math.round(((current - prior) / prior) * 100) : 0;
}

function deltaLabel(change: number): string {
    return `${change >= 0 ? '+' : ''}${change}% vs prior period`;
}

export default function OverviewTab({
    dateParams,
    selectedFacility,
    canSwitch,
    rangeLabel
}: OverviewTabProps) {
    const [sortKey, setSortKey] = useState<SortKey>('activation');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const query = `facility=${selectedFacility}&${dateQuery(dateParams)}`;

    const {
        data: metricsResp,
        isLoading: metricsLoading,
        mutate: mutateMetrics
    } = useSWR<ServerResponseOne<DepartmentMetrics>>(
        `/api/department-metrics?${query}`
    );

    const { data: trendResp, mutate: mutateTrend } = useSWR<
        ServerResponseOne<DailyLoginCount[]>
    >(`/api/department-metrics/login-trend?${query}`);

    const prior = priorParams(dateParams);
    const { data: priorMetricsResp, mutate: mutatePriorMetrics } = useSWR<
        ServerResponseOne<DepartmentMetrics>
    >(
        `/api/department-metrics?facility=${selectedFacility}&${dateQuery(prior)}`
    );

    const { data: comparisonResp, mutate: mutateComparison } = useSWR<
        ServerResponseOne<FacilityEngagement[]>
    >(
        canSwitch
            ? `/api/department-metrics/facility-comparison?${dateQuery(dateParams)}`
            : null
    );

    const rows = useMemo<ComparisonRow[]>(() => {
        const data = comparisonResp?.data ?? [];
        const derived = data.map((row) => ({
            ...row,
            avgPerActive: ratio(row.logins, row.active),
            activation: pct(row.active, row.registered)
        }));
        return derived.sort((a, b) => {
            const dir = sortDir === 'desc' ? -1 : 1;
            if (sortKey === 'facility_name') {
                return a.facility_name.localeCompare(b.facility_name) * dir;
            }
            return (a[sortKey] - b[sortKey]) * dir;
        });
    }, [comparisonResp, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await API.get(`department-metrics?${query}&reset=true`);
            await Promise.all([
                mutateMetrics(),
                mutateTrend(),
                mutateComparison(),
                mutatePriorMetrics()
            ]);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (metricsLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    const metrics = metricsResp?.data.data;
    if (!metrics) {
        return (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
                No insights data available for this selection.
            </div>
        );
    }

    const avgPerActive = ratio(metrics.total_logins, metrics.active_users);
    const lastUpdated = metricsResp?.data.last_cache
        ? new Date(metricsResp.data.last_cache).toLocaleString()
        : '';

    const newUsersChange = changePct(
        metrics.new_residents_added,
        priorMetricsResp?.data.data.new_residents_added ?? 0
    );
    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-brand-dark dark:text-white">
                            At a glance
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {rangeLabel}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRefresh()}
                            disabled={isRefreshing}
                            className="gap-1.5"
                        >
                            <ArrowPathIcon
                                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            />
                            Refresh
                        </Button>
                        {lastUpdated && (
                            <span className="text-xs text-muted-foreground">
                                Updated {lastUpdated}
                            </span>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <MetricCard
                        icon={UsersIcon}
                        value={metrics.total_residents.toLocaleString()}
                        label="Registered Residents"
                        sub={`${metrics.total_admins.toLocaleString()} staff ${
                            metrics.total_admins === 1 ? 'account' : 'accounts'
                        } · not counted`}
                        tooltip={
                            <>
                                <b>Total residents</b> who have a platform
                                account. Staff accounts are not included in this
                                total, but are shown below.
                            </>
                        }
                    />
                    <MetricCard
                        icon={UsersIcon}
                        value={metrics.active_users.toLocaleString()}
                        label="Active Residents"
                        sub={`${metrics.percent_active}% of registered`}
                        tooltip={
                            <>
                                Registered residents who{' '}
                                <b>logged in at least once </b>
                                in the range. <b>% of Registered </b> is active
                                residents &divide; registered residents
                            </>
                        }
                    />
                    <MetricCard
                        icon={UserPlusIcon}
                        value={metrics.new_residents_added.toLocaleString()}
                        label="New Residents Added"
                        sub={deltaLabel(newUsersChange)}
                        tooltip={
                            <>
                                Residents whose account was <b>first created</b>{' '}
                                within the range. The{' '}
                                <b>
                                    {newUsersChange >= 0 ? '+' : ''}
                                    {newUsersChange}%
                                </b>{' '}
                                compares against the prior window.
                            </>
                        }
                    />
                    <MetricCard
                        icon={ArrowTrendingUpIcon}
                        value={metrics.total_logins.toLocaleString()}
                        label="Total Resident Logins"
                        sub={`mean ${metrics.logins_per_day.toLocaleString()} / day`}
                        tooltip={
                            <>
                                Every resident <b>login event</b> in the range
                                (5 logins by one person count as 5).{' '}
                                <b>Staff logins</b> excluded.
                            </>
                        }
                    />
                    <MetricCard
                        icon={ChartBarIcon}
                        value={String(avgPerActive)}
                        label="Avg Logins / Active User"
                        sub="over selected range"
                        tooltip={
                            <>
                                Total resident logins &divide; active residents
                                (
                                <b>
                                    {metrics.total_logins}&nbsp;&divide;{' '}
                                    {metrics.active_users}
                                </b>
                                ). Divided by <b>active</b>, not registered, so
                                inactive accounts don't dilute it.
                            </>
                        }
                    />
                </div>
            </div>

            <div className="bg-card rounded-lg border border-gray-200 dark:border-border p-6">
                <h3 className="text-brand-dark dark:text-white">Login Trend</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    7-day smoothed average of daily logins across the selected
                    range
                </p>
                <LoginTrendChart data={trendResp?.data ?? []} />
            </div>

            {canSwitch && (
                <div className="bg-card rounded-lg border border-gray-200 dark:border-border overflow-hidden">
                    <div className="px-6 pt-5 pb-4">
                        <h3 className="text-brand-dark dark:text-white">
                            Facility Comparison
                        </h3>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableHead
                                    label="Facility"
                                    sortKey="facility_name"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                />
                                <SortableHead
                                    label="Registered"
                                    sortKey="registered"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                    alignRight
                                />
                                <SortableHead
                                    label="Active"
                                    sortKey="active"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                    alignRight
                                />
                                <SortableHead
                                    label="Logins"
                                    sortKey="logins"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                    alignRight
                                />
                                <SortableHead
                                    label="Avg / Active"
                                    sortKey="avgPerActive"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                    alignRight
                                />
                                <SortableHead
                                    label="Activation"
                                    sortKey="activation"
                                    activeKey={sortKey}
                                    onSort={toggleSort}
                                    alignRight
                                />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.facility_id}>
                                    <TableCell className="font-medium text-brand-dark dark:text-white">
                                        {row.facility_name}
                                    </TableCell>
                                    <TableCell className="text-right text-gray-700 dark:text-gray-300">
                                        {row.registered.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-gray-700 dark:text-gray-300">
                                        {row.active.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-gray-700 dark:text-gray-300">
                                        {row.logins.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-gray-700 dark:text-gray-300">
                                        {row.avgPerActive}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-brand"
                                                    style={{
                                                        width: `${row.activation}%`
                                                    }}
                                                />
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-300 w-10 text-right">
                                                {row.activation}%
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

interface SortableHeadProps {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    onSort: (key: SortKey) => void;
    alignRight?: boolean;
}

function SortableHead({
    label,
    sortKey,
    activeKey,
    onSort,
    alignRight
}: SortableHeadProps) {
    return (
        <TableHead
            className={`cursor-pointer ${alignRight ? 'text-right' : ''}`}
            onClick={() => onSort(sortKey)}
        >
            <div
                className={`flex items-center gap-1 ${alignRight ? 'justify-end' : ''}`}
            >
                {label}
                <ArrowsUpDownIcon
                    className={`size-3.5 ${activeKey === sortKey ? 'text-brand' : 'text-gray-400'}`}
                />
            </div>
        </TableHead>
    );
}
