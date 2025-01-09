import { isAdministrator, useAuth } from '@/useAuth';
import StatsCard from '@/Components/StatsCard';
import {
    AdminLayer2Join,
    Facility,
    LearningInsight,
    ServerResponseOne
} from '@/common';
import useSWR from 'swr';
// import convertSeconds from '@/Components/ConvertSeconds';
import { AxiosError } from 'axios';
import UnauthorizedNotFound from './Unauthorized';
import { useEffect, useState } from 'react';
import API from '@/api/api';
// import DropdownControl from '@/Components/inputs/DropdownControl';

export default function AdminLayer2() {
    const { user } = useAuth();
    const [facilities, setFacilities] = useState<Facility[]>();
    const [facility, setFacility] = useState('all');
    const [resetCache, setResetCache] = useState(false);
    // const [filterCourses, setFilterCourses] = useState<number>(0);
    // const [sortCourses, setSortCourses] = useState<string>(
    //     'order=asc&order_by=course_name'
    // );
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseOne<AdminLayer2Join>,
        AxiosError
    >(`/api/users/${user?.id}/admin-layer2?facility=${facility}`);

    useEffect(() => {
        void mutate();
    }, [facility, resetCache]);

    useEffect(() => {
        const fetchFacilities = async () => {
            const response = await API.get<Facility>('facilities');
            setFacilities(response.data as Facility[]);
        };
        void fetchFacilities();
    }, []);
    const layer2_metrics = data?.data;

    // function handleSortCourses(value: string) {
    //     const defaultSort = 'order=asc&order_by=course_name';
    //     if (value == 'completed') {
    //         setFilterCourses(1);
    //         setSortCourses(defaultSort);
    //     } else if (value == 'in_progress') {
    //         setFilterCourses(-1);
    //         setSortCourses(defaultSort);
    //     } else {
    //         setFilterCourses(0);
    //         setSortCourses(value);
    //     }
    // }

    if (error || isLoading || !user) return <div></div>;
    if (!isAdministrator(user)) {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
    return (
        <div className="p-8">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && layer2_metrics && (
                <>
                    <div className="p-4">
                        <button
                            className="button"
                            onClick={() => setResetCache(!resetCache)}
                        >
                            Refresh Data
                        </button>
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
                                {layer2_metrics.learning_insights?.map(
                                    (
                                        insight: LearningInsight,
                                        index: number
                                    ) => {
                                        return (
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
                                                    {insight.activity_hours}
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
