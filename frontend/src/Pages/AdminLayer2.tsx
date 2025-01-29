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

export default function AdminLayer2() {
    const { user } = useAuth();
    const [facility, setFacility] = useState('all');
    const [isToggleOn, setIsToggleOn] = useState(false);
    const { data: facilities, error: errorFacilitiesFetch } = useSWR<
        ServerResponseMany<Facility>,
        AxiosError
    >('/api/facilities');
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<AdminLayer2Join>,
        AxiosError
    >(
        `/api/users/${user?.id}/admin-layer2?facility=${facility}&alternate_view=${isToggleOn}`
    );
    useEffect(() => {
        void mutate();
    }, [isToggleOn, facility]);

    const handleDropdownChange = (value: string) => {
        if (value != 'all') {
            setIsToggleOn(false);
        }
        setFacility(value);
    };
    const handleToggleChange = () => {
        setIsToggleOn(!isToggleOn);
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
                    {facility === 'all' && (
                        <div className="mb-4">
                            <label htmlFor="viewToggle" className="mr-2">
                                Alternate View
                            </label>
                            <input
                                type="checkbox"
                                id="viewToggle"
                                checked={isToggleOn}
                                onChange={handleToggleChange}
                                className="toggle toggle-accent"
                            />
                        </div>
                    )}
                    {facility === 'all' && isToggleOn && (
                        <h2>Facility Summation View</h2>
                    )}
                    <div className="card card-row-padding mb-30">
                        {Object.entries(
                            layer2_metrics.learning_insights.reduce(
                                (
                                    acc: Record<string, LearningInsight[]>,
                                    insight: LearningInsight
                                ) => {
                                    if (!acc[insight.facility_name]) {
                                        acc[insight.facility_name] = [];
                                    }
                                    acc[insight.facility_name].push(insight);
                                    return acc;
                                },
                                {} as Record<string, LearningInsight[]>
                            )
                        ).map(([facility, insights]) => (
                            <div key={facility} className="mb-10">
                                <h3 className="facility-title">{facility}</h3>
                                <table className="table-2 mb-4">
                                    <thead>
                                        <tr className="grid-col-4">
                                            <th className="justify-self-start">
                                                Course Name
                                            </th>
                                            <th># Students Enrolled</th>
                                            <th>Completion Rate</th>
                                            <th className="justify-self-end pr-4">
                                                Total Activity Hours
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col gap-4 mt-4">
                                        {insights.map(
                                            (
                                                insight: LearningInsight,
                                                index: number
                                            ) => (
                                                <tr
                                                    className="grid-cols-4 justify-items-center"
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
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
