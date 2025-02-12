import { isAdministrator, useAuth } from '@/useAuth';
import StatsCard from '@/Components/StatsCard';
import {
    AdminLayer2Join,
    Facility,
    LearningInsight,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import UnauthorizedNotFound from './Unauthorized';
import { useState, useEffect } from 'react';

export default function AdminLayer2() {
    const { user } = useAuth();
    const [facility, setFacility] = useState('all');
    const [resetCache, setResetCache] = useState(false);
    const { data: facilities, error: errorFacilitiesFetch } = useSWR<
        ServerResponseMany<Facility>,
        AxiosError
    >('/api/facilities');
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<AdminLayer2Join>,
        AxiosError
    >(
        `/api/users/${user?.id}/admin-layer2?facility=${facility}&reset=${resetCache}`
    );
    useEffect(() => {
        void mutate();
    }, [facility, resetCache]);

    const layer2_metrics = data?.data;
    const formattedDate =
        layer2_metrics &&
        new Date(layer2_metrics?.last_cache).toLocaleString('en-US', {});

    if (error || isLoading || !user) return <div></div>;
    if (!isAdministrator(user)) {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
    return (
        <div className="w-full flex flex-col gap-2 pb-4 px-5">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && layer2_metrics && (
                <>
                    <div className="flex items-end justify-between pb-4">
                        <div className="flex flex-row gap-4">
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
                                        All Facilities
                                    </option>
                                    {errorFacilitiesFetch ? (
                                        <div>Error fetching facilities</div>
                                    ) : (
                                        facilities?.data?.map(
                                            (facility: Facility) => (
                                                <option
                                                    key={facility.id}
                                                    value={facility.id}
                                                >
                                                    {facility.name}
                                                </option>
                                            )
                                        )
                                    )}
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
                    {layer2_metrics && (
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <StatsCard
                                title="Total Courses Offered"
                                number={layer2_metrics.data.total_courses_offered.toString()}
                                label="courses"
                            />
                            <StatsCard
                                title="Total Students Enrolled"
                                number={layer2_metrics.data.total_students_enrolled.toString()}
                                label={'students'}
                            />
                            <StatsCard
                                title="Total Activity Time"
                                number={layer2_metrics.data.total_hourly_activity.toString()}
                                label="Hours"
                            />
                        </div>
                    )}
                    <div className="card card-row-padding mb-30">
                        <table className="table-2 mb-4">
                            <thead>
                                <tr className="grid-col-4">
                                    <th className="justify-self-start">
                                        Course Name
                                    </th>
                                    <th># Students Enrolled</th>
                                    <th># Students Completed</th>
                                    <th className="justify-center">
                                        Completion Rate
                                    </th>
                                    <th className="justify-self-end pr-4">
                                        Total Activity Hours
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="flex flex-col gap-4 mt-4">
                                {layer2_metrics.data.learning_insights?.map(
                                    (
                                        insight: LearningInsight,
                                        index: number
                                    ) => {
                                        return (
                                            <tr
                                                className="grid-cols-5 justify-items-center"
                                                key={index}
                                            >
                                                <td className="justify-self-start">
                                                    {insight.course_name}
                                                </td>
                                                <td>
                                                    {
                                                        insight.total_students_enrolled
                                                    }
                                                </td>
                                                <td>
                                                    {
                                                        insight.total_students_completed
                                                    }
                                                </td>
                                                <td>
                                                    {insight.completion_rate.toFixed(
                                                        2
                                                    )}
                                                    %
                                                </td>
                                                <td className="justify-self-end">
                                                    {insight.activity_hours.toLocaleString(
                                                        'en-US'
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
