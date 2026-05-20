import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { DepartmentMetrics, ServerResponseOne } from '@/common';
import StatsCard from './StatsCard';
import { ResponsiveContainer } from 'recharts';
import EngagementRateGraph from './EngagementRateGraph';
import { useAuth, canSwitchFacility } from '@/useAuth';
import DateRangePicker, {
    DateRangeValue,
    allTimeRange
} from './inputs/DateRangePicker';

const buildMetricsQuery = (
    facility: string,
    range: DateRangeValue,
    resetCache: boolean
) => {
    const params = new URLSearchParams({ facility });
    if (range.allTime) {
        params.set('all_time', 'true');
    } else {
        params.set('start_date', range.startDate);
        params.set('end_date', range.endDate);
    }
    if (resetCache) params.set('reset', 'true');
    return `/api/department-metrics?${params.toString()}`;
};

const rangeLabel = (range: DateRangeValue): string => {
    if (range.allTime) return 'all time';
    return `from ${range.startDate} to ${range.endDate}`;
};

const OperationalInsights = () => {
    const [facility, setFacility] = useState('all');
    const [dateRange, setDateRange] = useState<DateRangeValue>(allTimeRange);
    const [resetCache, setResetCache] = useState(false);
    const { user } = useAuth();

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<DepartmentMetrics>,
        Error
    >(buildMetricsQuery(facility, dateRange, resetCache));

    useEffect(() => {
        void mutate();
    }, [facility, dateRange, resetCache]);

    useEffect(() => {
        if (user && !canSwitchFacility(user)) {
            setFacility('');
        }
    }, [user, facility]);

    const metrics = data?.data;
    const formattedDate =
        metrics && new Date(metrics.last_cache).toLocaleString('en-US', {});

    const totalUsers = metrics?.data.total_residents ?? 0;
    const periodLabel = rangeLabel(dateRange);

    return (
        <div className="overflow-x-hidden">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <>
                    <div className="flex items-end justify-between pb-4 gap-4 flex-wrap">
                        <div className="flex flex-row gap-4 flex-wrap items-end">
                            <DateRangePicker
                                value={dateRange}
                                onChange={setDateRange}
                            />

                            {canSwitchFacility(user!) && (
                                <div>
                                    <label htmlFor="facility" className="label">
                                        <span className="label-text">
                                            Facility
                                        </span>
                                    </label>
                                    <select
                                        id="facility"
                                        className="select select-bordered w-full max-w-xs"
                                        value={facility}
                                        onChange={(e) =>
                                            setFacility(e.target.value)
                                        }
                                    >
                                        <option key={'all'} value={'all'}>
                                            All
                                        </option>
                                        {user?.facilities?.map((facility) => (
                                            <option
                                                key={facility.name}
                                                value={facility.id}
                                            >
                                                {facility.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="label label-text text-grey-3">
                                Last updated: {formattedDate}
                                <br />
                                Includes residents only
                            </p>
                            <button
                                className="button justify-self-end"
                                onClick={() => setResetCache(!resetCache)}
                            >
                                Refresh Data
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <StatsCard
                            title="Total Users"
                            number={totalUsers.toString()}
                            label="Users"
                            tooltip="Total number of residents in the facility"
                            tooltipClassName="tooltip-right"
                        />
                        <StatsCard
                            title="Active Users"
                            number={metrics.data.active_users.toString()}
                            label={`${(
                                (metrics.data.active_users / totalUsers) *
                                100
                            ).toFixed(2)}% of total`}
                            tooltip={
                                dateRange.allTime
                                    ? 'All time number of users who have logged in'
                                    : `Number of users who logged in ${periodLabel}`
                            }
                        />
                        <StatsCard
                            title="Inactive Users"
                            number={(
                                totalUsers - metrics.data.active_users
                            ).toString()}
                            label={
                                totalUsers - metrics.data.active_users === 1
                                    ? 'User'
                                    : 'Users'
                            }
                            tooltip={
                                dateRange.allTime
                                    ? 'All time number of users who have not logged in'
                                    : `Number of users who did not log in ${periodLabel}`
                            }
                        />
                        <StatsCard
                            title="New Users Added"
                            number={metrics.data.new_residents_added.toString()}
                            label={
                                metrics.data.new_residents_added === 1
                                    ? 'User'
                                    : 'Users'
                            }
                            tooltip={
                                dateRange.allTime
                                    ? 'All time number of new residents added'
                                    : `New residents added ${periodLabel}`
                            }
                        />
                        <StatsCard
                            title="Total Logins"
                            number={metrics.data.total_logins.toString()}
                            label={
                                metrics.data.total_logins === 1
                                    ? 'Login'
                                    : 'Logins'
                            }
                            tooltip={
                                dateRange.allTime
                                    ? 'All time number of logins'
                                    : `Number of logins ${periodLabel}`
                            }
                        />
                    </div>

                    <div className="card card-row-padding overflow-hidden">
                        <h2>Peak Login Times</h2>
                        <ResponsiveContainer
                            className="w-full h-full overflow-visible"
                            width="100%"
                            height="250px"
                            debounce={500}
                            maxHeight={250}
                        >
                            <EngagementRateGraph
                                data={metrics?.data.peak_login_times || []}
                                viewType="peakLogin"
                            />
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    );
};

export default OperationalInsights;
