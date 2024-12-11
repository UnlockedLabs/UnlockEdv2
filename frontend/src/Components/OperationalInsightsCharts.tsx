import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import API from '@/api/api';
import { Facility, LoginMetrics, ServerResponseOne } from '@/common';
import StatsCard from './StatsCard';
import PeakLoginTimesChart from './PeakLoginTimesChart';
import { ResponsiveContainer } from 'recharts';
import EngagementRateGraph from './EngagementRateGraph';

const OperationalInsights = () => {
    const [facilities, setFacilities] = useState<Facility[]>();
    const [facility, setFacility] = useState('all');
    const [days, setDays] = useState(7);
    const [resetCache, setResetCache] = useState(false);

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<LoginMetrics>,
        AxiosError
    >(
        `/api/login-metrics?facility=${facility}&days=${days}&reset=${resetCache}`
    );

    useEffect(() => {
        void mutate();
    }, [facility, days, resetCache]);

    useEffect(() => {
        const fetchFacilities = async () => {
            const response = await API.get<Facility>('facilities');
            setFacilities(response.data as Facility[]);
        };
        void fetchFacilities();
    }, []);

    const metrics = data?.data;

    return (
        <div className="p-6">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <>
                    <div className="">
                        <button
                            className="button"
                            onClick={() => setResetCache(!resetCache)}
                        >
                            Refresh Data
                        </button>
                        <div className="flex flex-row gap-4">
                            <div>
                                <label htmlFor="days" className="label">
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
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <StatsCard
                            title="Total Users"
                            number={metrics.total_users.toString()}
                            label="users"
                        />
                        <StatsCard
                            title="Active Users"
                            number={metrics.active_users.toString()}
                            label={`${(
                                (metrics.active_users / metrics.total_users) *
                                100
                            ).toFixed(2)}% of total`}
                        />
                        <StatsCard
                            title="Inactive Users"
                            number={(
                                metrics.total_users - metrics.active_users
                            ).toString()}
                            label="users"
                        />
                        <StatsCard
                            title="Total Logins"
                            number={metrics.total_logins.toString()}
                            label="logins"
                        />
                        <StatsCard
                            title="Logins per Day"
                            number={metrics.logins_per_day.toString()}
                            label="logins/day"
                        />
                        <StatsCard
                            title="New Residents Added"
                            number={metrics.new_residents_added.toString()}
                            label="residents"
                        />
                    </div>
                    <div className="card card-row-padding mb-30">
                        <div className="flex flex-row gap-6">
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PeakLoginTimesChart
                                        peak_login_times={
                                            metrics?.peak_login_times
                                        }
                                    />
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height={350}>
                                    <EngagementRateGraph
                                        active={metrics?.active_users}
                                        inactive={
                                            metrics.total_users -
                                            metrics.active_users
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
