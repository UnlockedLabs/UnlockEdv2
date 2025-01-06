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
                            label=""
                        />
                        <StatsCard
                            title="Total Students Enrolled"
                            number={layer2_metrics.total_students_enrolled.toString()}
                            label={''}
                        />
                        <StatsCard
                            title="Total Activity Time"
                            number={layer2_metrics.total_hourly_activity.toString()}
                            label="Hours"
                        />
                    </div>
                    <div className="card card-row-padding mb-30">
                        <div className="flex flex-row gap-12">
                            <div className="card bg-base-teal h-[531px] w-full p-4 overflow-y-auto">
                                <div className="flex flex-row justify-between">
                                    <h2 className="mt-2">Course Metrics</h2>
                                    {/* <DropdownControl
                                        label="Sort by"
                                        customCallback={handleSortCourses}
                                        enumType={{
                                            Name: 'order=asc&order_by=course_name',
                                            'Completed Only': 'completed',
                                            'In Progress Only': 'in_progress',
                                            'Total time':
                                                'order=desc&order_by=total_time'
                                            //"Grade": "order=asc&order_by=grade",
                                        }}
                                    /> */}
                                </div>
                                <table className="w-full mt-4">
                                    <thead>
                                        <tr className="flex flex-row justify-between border border-x-0 border-t-0 body text-grey-4 text-left">
                                            <th className="w-1/2">
                                                Course Name
                                            </th>
                                            <th className="w-1/5">
                                                # Students Enrolled
                                            </th>
                                            <th className="w-1/5">
                                                Completion Rate
                                            </th>
                                            <th className="w-1/5">
                                                Total Activity Hours
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col gap-4 mt-4">
                                        {layer2_metrics.learningInsights?.map(
                                            (
                                                insight: LearningInsight,
                                                index: number
                                            ) => {
                                                return (
                                                    <tr
                                                        className="flex flex-row justify-between body-small items-center"
                                                        key={index}
                                                    >
                                                        <td className="w-1/2">
                                                            {
                                                                insight.course_name
                                                            }
                                                        </td>
                                                        <td className="w-1/2">
                                                            500
                                                        </td>
                                                        <td className="w-1/2">
                                                            78%
                                                        </td>
                                                        <td className="w-1/2">
                                                            5675657
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
