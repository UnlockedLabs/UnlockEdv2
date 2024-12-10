import { useAuth } from '@/useAuth';
import { useState } from 'react';
import { AxiosError } from 'axios';
import StatsCard from '@/Components/StatsCard';
import UserActivityMap from '@/Components/UserActivityMap';
import DarkGreenPill from '@/Components/pill-labels/DarkGreenPill';
import TealPill from '@/Components/pill-labels/TealPill';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { ServerResponse, UserCourses, UserCoursesInfo } from '@/common';
import convertSeconds from '@/Components/ConvertSeconds';

export default function MyProgress() {
    const [sortCourses, setSortCourses] = useState<string>(
        'order=asc&order_by=course_name'
    );
    const [filterCourses, setFilterCourses] = useState<number>(0);
    const { user } = useAuth();
    if (!user) {
        return;
    }
    const { data, isLoading, error } = useSWR<
        ServerResponse<UserCoursesInfo>,
        AxiosError
    >(`/api/users/${user.id}/courses?${sortCourses}`);

    const courseData = data?.data
        ? (data?.data as UserCoursesInfo)
        : ({} as UserCoursesInfo);
    if (isLoading) {
        return <div>Loading...</div>;
    }

    function handleSortCourses(value: string) {
        const defaultSort = 'order=asc&order_by=course_name';
        if (value == 'completed') {
            setFilterCourses(1);
            setSortCourses(defaultSort);
        } else if (value == 'in_progress') {
            setFilterCourses(-1);
            setSortCourses(defaultSort);
        } else {
            setFilterCourses(0);
            setSortCourses(value);
        }
    }

    //function handleSortCertificates(value: string) {
    //    setSortCertificates(value);
    //}

    return (
        <div className="px-8 py-4">
            <h1>My Progress</h1>
            {!error && courseData && (
                <>
                    <div className="mt-7 flex flex-row gap-12">
                        <div className="flex flex-col justify-between w-full">
                            <StatsCard
                                title="TOTAL TIME"
                                number={Math.floor(
                                    courseData.total_time / 3600
                                ).toString()}
                                label="hours"
                            />
                            <StatsCard
                                title="COMPLETED"
                                number={courseData.num_completed.toString()}
                                label="courses"
                            />
                        </div>
                        <div className="w-full">
                            <UserActivityMap />
                        </div>
                    </div>
                    <div className="flex flex-row gap-12 mt-12">
                        <div className="card bg-base-teal h-[531px] w-full p-4 overflow-y-auto">
                            <div className="flex flex-row justify-between">
                                <h2 className="mt-2">All Courses</h2>
                                <DropdownControl
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
                                />
                            </div>
                            <table className="w-full mt-4">
                                <thead>
                                    <tr className="flex flex-row justify-between border border-x-0 border-t-0 body text-grey-4 text-left">
                                        <th className="w-1/2">Course Name</th>
                                        <th className="w-1/5">Status</th>
                                        <th className="w-1/5">Hours Spent</th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-4 mt-4">
                                    {courseData.courses.map(
                                        (
                                            course: UserCourses,
                                            index: number
                                        ) => {
                                            const courseTotalTime =
                                                convertSeconds(
                                                    course.total_time
                                                );
                                            if (
                                                filterCourses == 1 &&
                                                course.course_progress < 100
                                            ) {
                                                return;
                                            } else if (
                                                filterCourses == -1 &&
                                                course.course_progress == 100
                                            ) {
                                                return;
                                            }
                                            return (
                                                <tr
                                                    className="flex flex-row justify-between body-small items-center"
                                                    key={index}
                                                >
                                                    <td className="w-1/2">
                                                        {course.course_name}
                                                    </td>
                                                    <td className="w-1/5 flex">
                                                        {course.course_progress ==
                                                        100 ? (
                                                            <DarkGreenPill>
                                                                completed
                                                            </DarkGreenPill>
                                                        ) : (
                                                            <TealPill>
                                                                in progress
                                                            </TealPill>
                                                        )}
                                                    </td>
                                                    <td className="w-1/5">
                                                        {courseTotalTime.number +
                                                            ' ' +
                                                            courseTotalTime.label}
                                                    </td>
                                                </tr>
                                            );
                                        }
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
