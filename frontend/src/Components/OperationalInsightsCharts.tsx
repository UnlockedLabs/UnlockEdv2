import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import { Facility, LoginMetrics, ServerResponseOne } from '@/common';
import StatsCard from './StatsCard';
import { ResponsiveContainer } from 'recharts';
import EngagementRateGraph from './EngagementRateGraph';

const OperationalInsights = () => {
    const [facility, setFacility] = useState('all');
    const [days, setDays] = useState(7);
    const [resetCache, setResetCache] = useState(false);

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<LoginMetrics>,
        AxiosError
    >(
        `/api/login-metrics?facility=${facility}&days=${days}&reset=${resetCache}`
    );
    const { data: facilitiesData } =
        useSWR<ServerResponseOne<Facility[]>>('/api/facilities');

    useEffect(() => {
        void mutate();
    }, [facility, days, resetCache]);

    const facilities = facilitiesData?.data;

    const metrics = data?.data;
    const formattedDate =
        metrics && new Date(metrics.last_cache).toLocaleString('en-US', {});

    const totalUsers =
        (metrics?.data.total_residents ?? 0) +
        (metrics?.data.total_admins ?? 0);
    return (
        <div className="overflow-x-hidden">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <>
                    <div className="flex items-end justify-between pb-4">
                        <div className="flex flex-row gap-4">
                            <div>
                                <label
                                    htmlFor="days"
                                    className="label  leading-tight"
                                >
                                    <span className="label-text">Days</span>
                                </label>
                                <select
                                    id="days"
                                    className="select select-bordered w-full max-w-xs"
                                    value={days}
                                    onChange={(e) =>
                                        setDays(parseInt(e.target.value))
                                    }
                                >
                                    <option value={7}>Last 7 days</option>
                                    <option value={30}>Last 30 days</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="facility" className="label">
                                    <span className="label-text">Facility</span>
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
                                    {facilities?.map((facility) => (
                                        <option
                                            key={facility.id}
                                            value={facility.id}
                                        >
                                            {facility.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <p className="label label-text text-grey-3">
                                Last updated: {formattedDate}
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
                            tooltip="Total number of admins and residents in the facility"
                        />
                        <StatsCard
                            title="Active Users"
                            number={metrics.data.active_users.toString()}
                            label={`${(
                                (metrics.data.active_users / totalUsers) *
                                100
                            ).toFixed(2)}% of total`}
                            tooltip={`Number of users who have logged in in the last ${days} days`}
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
                            tooltip={`Number of users who have not logged in in the last ${days} days`}
                        />
                        <StatsCard
                            title="New Admins Added"
                            number={metrics.data.new_admins_added.toString()}
                            label={
                                metrics.data.new_admins_added === 1
                                    ? 'Admin'
                                    : 'Admins'
                            }
                            tooltip={`Number of new admins added in the last ${days} days`}
                        />
                        <StatsCard
                            title="New Residents Added"
                            number={metrics.data.new_residents_added.toString()}
                            label={
                                metrics.data.new_residents_added === 1
                                    ? 'Resident'
                                    : 'Residents'
                            }
                            tooltip={`Number of new residents added in the last ${days} days`}
                        />
                        <StatsCard
                            title="Total Logins"
                            number={metrics.data.total_logins.toString()}
                            label={
                                metrics.data.total_logins === 1
                                    ? 'Login'
                                    : 'Logins'
                            }
                            tooltip={`Total number of logins in the last ${days} days`}
                        />
                    </div>

                    <div className="card card-row-padding overflow-hidden">
                        <h1 className="">Peak Login Times</h1>
                        <div className=" items-stretch gap-12 px-10 pt-10 ">
                            <div className="w-full h-[500px] overflow-visible">
                                <ResponsiveContainer
                                    className="w-full h-full overflow-visible"
                                    width="100%"
                                    height="100%"
                                    debounce={500}
                                >
                                    <EngagementRateGraph
                                        peak_login_times={
                                            metrics?.data.peak_login_times || []
                                        }
                                    />
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default OperationalInsights;
