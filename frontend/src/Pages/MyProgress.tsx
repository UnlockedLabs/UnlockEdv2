import { useAuth } from '@/AuthContext';
import { useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import UserActivityMap from '@/Components/UserActivityMap';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DarkGreenPill from '@/Components/pill-labels/DarkGreenPill';
import TealPill from '@/Components/pill-labels/TealPill';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    Outcome,
    ServerResponse,
    UserPrograms,
    UserProgramsInfo
} from '@/common';
import convertSeconds from '@/Components/ConvertSeconds';
import Error from './Error';

export default function MyProgress() {
    const [sortPrograms, setSortPrograms] = useState<string>(
        'order=asc&order_by=program_name'
    );
    const [sortCertificates, setSortCertificates] = useState<string>(
        'order=asc&order_by=program_name'
    );
    const [filterPrograms, setFilterPrograms] = useState<number>(0);
    const { user } = useAuth();
    const { data, isLoading, error } = useSWR<ServerResponse<UserProgramsInfo>>(
        `/api/users/${user.id}/programs?${sortPrograms}`
    );
    const programData = data?.data
        ? (data?.data as UserProgramsInfo)
        : ({} as UserProgramsInfo);

    const {
        data: certificates,
        isLoading: loadingOutcomes,
        error: outcomesError
    } = useSWR<ServerResponse<Outcome>>(
        `/api/users/${user.id}/outcomes?type=certificate&${sortCertificates}`
    );
    const certData = certificates ? (certificates?.data as Outcome[]) : [];

    if (isLoading || loadingOutcomes) return <div>Loading...</div>;
    if (error || outcomesError) return <Error />;

    function handleSortPrograms(value: string) {
        const defaultSort = 'order=asc&order_by=program_name';
        if (value == 'completed') {
            setFilterPrograms(1);
            setSortPrograms(defaultSort);
        } else if (value == 'in_progress') {
            setFilterPrograms(-1);
            setSortPrograms(defaultSort);
        } else {
            setFilterPrograms(0);
            setSortPrograms(value);
        }
    }

    function handleSortCertificates(value: string) {
        setSortCertificates(value);
    }

    return (
        <AuthenticatedLayout title="My Progress" path={['My Progress']}>
            <div className="px-8 py-4">
                <h1>My Progress</h1>
                {programData && (
                    <>
                        <div className="mt-7 flex flex-row gap-12">
                            <div className="flex flex-col justify-between w-full">
                                <StatsCard
                                    title="TOTAL TIME"
                                    number={Math.floor(
                                        programData.total_time / 3600
                                    ).toString()}
                                    label="hours"
                                />
                                <StatsCard
                                    title="COMPLETED"
                                    number={programData.num_completed.toString()}
                                    label="courses"
                                />
                            </div>
                            <div className="w-full">
                                <UserActivityMap />
                            </div>
                        </div>
                        <div className="flex flex-row gap-12 mt-12">
                            <div className="card bg-base-teal h-[531px] w-[60%] p-4 overflow-y-auto">
                                <div className="flex flex-row justify-between">
                                    <h2 className="mt-2">All Courses</h2>
                                    <DropdownControl
                                        label="Sort by"
                                        callback={handleSortPrograms}
                                        enumType={{
                                            Name: 'order=asc&order_by=program_name',
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
                                            <th className="w-1/2">
                                                Course Name
                                            </th>
                                            <th className="w-1/5">Status</th>
                                            <th className="w-1/5">Grade</th>
                                            <th className="w-1/5">
                                                Hours Spent
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col gap-4 mt-4">
                                        {programData.programs.map(
                                            (
                                                course: UserPrograms,
                                                index: number
                                            ) => {
                                                const courseTotalTime =
                                                    convertSeconds(
                                                        course.total_time
                                                    );
                                                if (
                                                    filterPrograms == 1 &&
                                                    course.course_progress < 100
                                                ) {
                                                    return;
                                                } else if (
                                                    filterPrograms == -1 &&
                                                    course.course_progress ==
                                                        100
                                                ) {
                                                    return;
                                                }
                                                return (
                                                    <tr
                                                        className="flex flex-row justify-between body-small items-center"
                                                        key={index}
                                                    >
                                                        <td className="w-1/2">
                                                            {
                                                                course.program_name
                                                            }
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
                                                            {course?.grade ||
                                                                '-'}
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
                            <div className="card bg-base-teal h-[531px] w-[40%] p-4 overflow-y-auto">
                                <div className="flex flex-row gap-x-4">
                                    <h2 className="mt-2">
                                        Certificates Earned
                                    </h2>
                                    <DropdownControl
                                        label="Sort by"
                                        callback={handleSortCertificates}
                                        enumType={{
                                            'Name (A-Z)':
                                                'order=asc&order_by=program_name',
                                            'Name (Z-A)':
                                                'order=desc&order_by=program_name',
                                            Newest: 'order=desc&order_by=created_at',
                                            Oldest: 'order=asc&order_by=created_at'
                                        }}
                                    />
                                </div>
                                <table className="w-full mt-4">
                                    <thead>
                                        <tr className="flex flex-row justify-between border border-x-0 border-t-0">
                                            <th className="body text-grey-4">
                                                Certificate
                                            </th>
                                            <th className="body text-grey-4">
                                                Date Recieved
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col gap-4 mt-4">
                                        {certData?.map((certificate: any) => {
                                            return (
                                                <tr
                                                    className="flex flex-row justify-between body-small items-center"
                                                    key={Math.random()}
                                                >
                                                    <td className="w-1/2">
                                                        {
                                                            certificate.program_name
                                                        }
                                                    </td>
                                                    <td className="w-1/5 flex">
                                                        {new Date(
                                                            certificate.created_at.split(
                                                                'T'
                                                            )[0]
                                                        ).toLocaleDateString(
                                                            'en-US'
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
