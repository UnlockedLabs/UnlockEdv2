import { useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { RecentCourse, ActivityMapData, RecentActivity } from '@/types';
import EnrolledCourseCard from '@/components/student/EnrolledCourseCard';
import WeeklyActivity from '@/components/dashboard/WeeklyActivity';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const INITIAL_VISIBLE = 4;

function RecentCoursesTable({ courses }: { courses: RecentCourse[] }) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex-1">
            <h3 className="text-lg font-semibold text-[#203622] mb-3">
                Recent Activity
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Course
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Provider
                            </th>
                            <th className="text-right py-2 text-gray-500 font-medium">
                                Progress
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map((course, idx) => (
                            <tr
                                key={idx}
                                className="border-b border-gray-50 last:border-0"
                            >
                                <td className="py-3 pr-4 text-[#203622] font-medium">
                                    <a
                                        href={course.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        {course.course_name}
                                    </a>
                                </td>
                                <td className="py-3 pr-4 text-gray-500">
                                    {course.provider_platform_name}
                                </td>
                                <td className="py-3 text-right text-gray-500">
                                    {Math.floor(course.course_progress)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function StudentDashboard() {
    const { user } = useAuth();
    const { courses, week_activity } = useLoaderData() as {
        courses: RecentCourse[];
        week_activity: ActivityMapData[];
    };
    const [expanded, setExpanded] = useState(false);

    if (!user) return null;

    const visibleCount = expanded ? courses.length : INITIAL_VISIBLE;

    const recentActivities: RecentActivity[] = week_activity.map((a) => ({
        date: a.date,
        delta: Number(a.total_time)
    }));

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-[#203622]">
                    Hi, {user.name_first ?? 'Student'}!
                </h1>

                <section>
                    <h2 className="text-xl font-semibold text-[#203622] mb-4">
                        Pick Up Where You Left Off
                    </h2>
                    {courses.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {courses
                                    .slice(0, visibleCount)
                                    .map((course, idx) => (
                                        <EnrolledCourseCard
                                            key={idx}
                                            course={course}
                                            recent
                                        />
                                    ))}
                            </div>
                            {courses.length > INITIAL_VISIBLE && (
                                <div className="flex justify-end mt-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setExpanded(!expanded)}
                                        className="text-[#556830] hover:text-[#203622]"
                                    >
                                        {expanded ? (
                                            <>
                                                See less
                                                <ChevronUp className="size-4 ml-1" />
                                            </>
                                        ) : (
                                            <>
                                                See all courses
                                                <ChevronDown className="size-4 ml-1" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <EmptyState
                            icon={<BookOpen className="size-6 text-gray-400" />}
                            title="No courses yet"
                            description="You are not currently enrolled in any courses."
                        />
                    )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                        <h3 className="text-lg font-semibold text-[#203622] mb-3">
                            My Activity
                        </h3>
                        <WeeklyActivity data={recentActivities} />
                    </div>
                    <RecentCoursesTable courses={courses.slice(0, 5)} />
                </div>
            </div>
        </div>
    );
}
