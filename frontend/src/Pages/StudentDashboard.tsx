import { isAdministrator, useAuth } from '@/useAuth';
import WeekActivityChart from '@/Components/WeeklyActivity';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { ActivityMapData, RecentActivity, RecentCourse } from '@/common';
import CourseCard from '@/Components/EnrolledCourseCard';
import { ResidentWeeklyActivityTable } from '@/Components/dashboard';
import { useState } from 'react';

export default function StudentLayer2() {
    const { user } = useAuth();
    const navigate = useNavigate();
    if (!user) {
        return;
    } else if (isAdministrator(user)) {
        navigate('/learning-insights');
        return;
    }
    const { courses, week_activity } = useLoaderData() as {
        courses: RecentCourse[];
        week_activity: ActivityMapData[];
    };
    const [expanded, setExpanded] = useState<boolean>(false);
    const slice = expanded ? courses.length : 4;

    const recentActivities: RecentActivity[] = week_activity.map(
        (activity) => ({
            date: activity.date,
            delta: Number(activity.total_time)
        })
    );

    return (
        <div className="w-full flex flex-col gap-6 px-6 pb-4">
            <h1 className="text-5xl">Hi, {user.name_first ?? 'Student'}!</h1>
            <h2> Pick Up Where You Left Off</h2>
            <div className="card card-row-padding flex flex-col gap-3">
                <div className="gap-3 grid grid-cols-4">
                    {courses
                        .slice(0, slice)
                        .map((course: RecentCourse, index: number) => {
                            return (
                                <CourseCard
                                    course={course}
                                    recent
                                    key={index}
                                />
                            );
                        })}
                </div>
                {courses.length > 4 && (
                    <button
                        className="flex justify-end text-teal-3 hover:text-teal-4 body"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? 'See less' : 'See all courses'}
                    </button>
                )}
            </div>
            <div className="flex flex-row gap-12">
                <div className="w-1/2 h-[254px] bg-base-teal card">
                    <h2 className="mt-4 ml-4">My Activity</h2>
                    <WeekActivityChart data={recentActivities} />
                </div>
                <ResidentWeeklyActivityTable courses={courses} />
            </div>
        </div>
    );
}
