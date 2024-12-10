import { isAdministrator, useAuth } from '@/useAuth';
import MilestonesBarChart from '@/Components/MilestonesBarChart';
import ActivityChart from '@/Components/MonthActivityChart';
import StatsCard from '@/Components/StatsCard';
import TopProgPieChart from '@/Components/TopProgActivityPieChart';
import { AdminDashboardJoin, CourseActivity, ServerResponse } from '@/common';
import useSWR from 'swr';
import convertSeconds from '@/Components/ConvertSeconds';
import { useContext } from 'react';
import { ThemeContext } from '@/Context/ThemeContext';
import { AxiosError } from 'axios';
import UnauthorizedNotFound from './Unauthorized';

export default function AdminLayer2() {
    const { user } = useAuth();
    const { data, error, isLoading } = useSWR<
        ServerResponse<AdminDashboardJoin>,
        AxiosError
    >(`/api/users/${user?.id}/admin-dashboard`);
    const { theme } = useContext(ThemeContext);

    if (error || isLoading || !user) return <div></div>;
    if (!isAdministrator(user)) {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
    const activityData = data?.data as AdminDashboardJoin;
    const avgActivity = convertSeconds(activityData.avg_daily_activity);
    const totalActivity = convertSeconds(activityData.total_weekly_activity);
    return (
        <div className="px-8 py-4">
            <h1 className="text-5xl">{user.facility_name}</h1>
            <div className="flex flex-row mt-12 gap-12">
                <div className="flex flex-col gap-6 w-2/3">
                    <div className="card h-[240px]">
                        <h2 className="card-h-padding">
                            Overall Platform Engagement
                        </h2>
                        <ActivityChart data={activityData.monthly_activity} />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <StatsCard
                            title={'ACTIVE USERS'}
                            number={`${activityData.weekly_active_users}`}
                            label={'students'}
                        />
                        <StatsCard
                            title={'AVG DAILY ACTIVITY'}
                            number={avgActivity.number.toString()}
                            label={avgActivity.label}
                        />
                        <StatsCard
                            title={'TOTAL WEEK ACTIVITY'}
                            number={totalActivity.number.toString()}
                            label={totalActivity.label}
                        />
                    </div>
                    <div className="card h-[368px] p-4">
                        <h2>Top Milestone Completion Per Course</h2>
                        <MilestonesBarChart
                            data={activityData.course_milestones}
                        />
                    </div>
                </div>
                {/* Top course engagement */}
                <div className="card h-100 flex flex-col flex-grow justify-between overflow-auto">
                    <h2 className="card-h-padding">Top Course Engagement</h2>
                    <div className="">
                        <TopProgPieChart
                            data={activityData.top_course_activity}
                        />
                        <div className="px-4 pb-10">
                            {/* TO DO: caption needs to be added */}
                            <table className="table-2">
                                <thead>
                                    <tr>
                                        <th>Course Name</th>
                                        <th>Time Spent</th>
                                    </tr>
                                </thead>
                                <tbody className="!gap-6">
                                    {activityData?.top_course_activity.map(
                                        (
                                            course: CourseActivity,
                                            index: number
                                        ) => {
                                            let courseTime: string;
                                            if (course.hours_engaged < 1)
                                                courseTime =
                                                    Math.round(
                                                        course.hours_engaged *
                                                            60
                                                    ) + ' min';
                                            else {
                                                const hours = Math.floor(
                                                    course.hours_engaged
                                                );
                                                const leftoverMins =
                                                    Math.round(
                                                        course.hours_engaged *
                                                            60
                                                    ) % 60;
                                                if (leftoverMins == 0)
                                                    courseTime = hours + ' hrs';
                                                else
                                                    courseTime =
                                                        hours +
                                                        ' hr ' +
                                                        leftoverMins +
                                                        ' min';
                                            }
                                            let legendColor =
                                                'bg-teal-' +
                                                (index + 1).toString();
                                            // TO DO: temporary fix... figure out why teal-5 doesnt render immediately
                                            if (index == 4)
                                                legendColor =
                                                    theme == 'light'
                                                        ? 'bg-[#002E2A]'
                                                        : 'bg-[#B0DFDA]';
                                            return (
                                                <tr key={index}>
                                                    <td className="flex flex-row gap-2">
                                                        <div
                                                            className={`h-3 w-3 ${legendColor} my-auto`}
                                                        ></div>
                                                        {course.course_name}
                                                    </td>
                                                    <td>{courseTime}</td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
