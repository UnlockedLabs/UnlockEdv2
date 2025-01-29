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
import { useEffect, useState } from 'react';

// TODO:
// remove the facility dropdown and use the facility_switcher to
// control metrics:
// function should take the facility string that is on the page
// and compare that string to the value

export default function AdminLayer2() {
    const { user } = useAuth();
    const [facility, setFacility] = useState('all');
    const { data: facilities, error: errorFacilitiesFetch } = useSWR<
        ServerResponseMany<Facility>,
        AxiosError
    >('/api/facilities');
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<AdminLayer2Join>,
        AxiosError
    >(`/api/users/${user?.id}/admin-layer2?facility=${facility}`);
    useEffect(() => {
        void mutate();
    }, [facility]);

    const handleDropdownChange = (value: string) => {
        setFacility(value);
    };
    const layer2_metrics = data?.data;

    if (error || isLoading || !user) return <div></div>;
    if (!isAdministrator(user)) {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
    return (
        <div className="w-full flex flex-col gap-2 px-5 pb-4">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {/* TODO: Having access to the facility_name field here {user.facility_name}  is the same string that controls the  Facility Dropdown on PageNav can I use that string to filter all total_courses_offered, total_students_enrolled, total_activity_time, as well as the Learning insights table.*/}
            {data && layer2_metrics && (
                <>
                    <div className="flex flex-row justify-between mb-6">
                        <select
                            id="facility"
                            className="select select-bordered w-full max-w-xs"
                            value={facility}
                            onChange={(e) =>
                                handleDropdownChange(e.target.value)
                            }
                        >
                            <option key={'all'} value={'all'}>
                                All Facilities
                            </option>
                            {errorFacilitiesFetch ? (
                                <div>Error fetching facilities</div>
                            ) : (
                                facilities?.data?.map((facility: Facility) => (
                                    <option
                                        key={facility.id}
                                        value={facility.id}
                                    >
                                        {facility.name}
                                    </option>
                                ))
                            )}
                        </select>
                        <button
                            className="button"
                            onClick={() => void mutate()}
                        >
                            Refresh Data
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <StatsCard
                            title="Total Courses Offered"
                            number={layer2_metrics.total_courses_offered.toString()}
                            label="courses"
                        />
                        <StatsCard
                            title="Total Students Enrolled"
                            number={layer2_metrics.total_students_enrolled.toString()}
                            label={'students'}
                        />
                        <StatsCard
                            title="Total Activity Time"
                            number={layer2_metrics.total_hourly_activity.toString()}
                            label="Hours"
                        />
                    </div>
                    <div className="card card-row-padding mb-30">
                        <div className="mb-10">
                            <table className="table-2 mb-4">
                                <thead>
                                    <tr className="grid-col-5">
                                        <th className="justify-self-start">
                                            Course Name
                                        </th>
                                        <th># Students Enrolled</th>
                                        <th># Students Completed</th>
                                        <th>Completion Rate</th>
                                        <th className="justify-self-end pr-4">
                                            Total Activity Hours
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-4 mt-4">
                                    {layer2_metrics.learning_insights.map(
                                        (
                                            insight: LearningInsight,
                                            index: number
                                        ) => (
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
                                                <td>{insight.completions}</td>
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
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
