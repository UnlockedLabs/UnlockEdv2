import { isAdministrator, useAuth } from '@/useAuth';
import useSWR from 'swr';
import WeekActivityChart from '@/Components/WeeklyActivity';
import Error from './Error';
import { useNavigate } from 'react-router-dom';
import { ServerResponse, StudentDashboardJoin } from '@/common';
import { AxiosError } from 'axios';
import {
    CurrentlyEnrolledCourses,
    ResidentRecentCourses,
    ResidentWeeklyActivityTable
} from '@/Components/dashboard';
import ResourcesSideBar from '@/Components/ResourcesSideBar';

export default function StudentLayer2() {
    const { user } = useAuth();
    const navigate = useNavigate();
    if (!user) {
        return;
    } else if (isAdministrator(user)) {
        navigate('/learning-insights');
        return;
    }
    const { data, error, isLoading } = useSWR<
        ServerResponse<StudentDashboardJoin>,
        AxiosError
    >(`/api/users/${user?.id}/student-dashboard`);
    const userData = data?.data as StudentDashboardJoin;

    if (isLoading) return <div>Loading...</div>;
    if (error) return <Error />;

    return (
        <div className="flex flex-row">
            {/* main section */}
            <div className="w-full flex flex-col gap-6 px-6 pb-4">
                <h1 className="text-5xl">
                    Hi, {user.name_first ?? 'Student'}!
                </h1>
                <h2> Pick Up Where You Left Off</h2>
                <div className="card card-row-padding">
                    <ResidentRecentCourses userData={userData} />
                </div>
                <div className="flex flex-row gap-12">
                    <div className="w-1/2 h-[254px] bg-base-teal card">
                        <h2 className="mt-4 ml-4">My Activity</h2>
                        <WeekActivityChart data={userData?.week_activity} />
                    </div>
                    <ResidentWeeklyActivityTable userData={userData} />
                </div>
                <h2>Currently Enrolled Classes</h2>
                <CurrentlyEnrolledCourses userData={userData} />
            </div>
            {/* right sidebar */}
            <ResourcesSideBar />
        </div>
    );
}
