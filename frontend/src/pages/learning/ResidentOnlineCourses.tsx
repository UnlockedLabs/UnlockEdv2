import { Navigate, useLoaderData } from 'react-router-dom';
import { useAuth, hasFeature } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import type { UserCourses, ActivityMapData } from '@/types';
import { PageHeader } from '@/components/shared';
import { UserCoursesStatsGrid } from '@/components/student/UserCoursesStatsGrid';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

interface LoaderData {
    courses: UserCourses[];
    week_activity: ActivityMapData[];
}

export default function ResidentOnlineCourses() {
    const { user } = useAuth();
    const loaderData = useLoaderData() as LoaderData | undefined;

    if (!user) return null;

    if (!hasFeature(user, FeatureAccess.ProviderAccess)) {
        return <Navigate to="/resident-programs" replace />;
    }

    const courses = loaderData?.courses ?? [];
    const summary = {
        num_completed: courses.filter((c) => c.course_progress >= 100).length,
        num_in_progress: courses.filter(
            (c) => c.course_progress > 0 && c.course_progress < 100
        ).length,
        total_time: courses.reduce((sum, c) => sum + (c.total_time ?? 0), 0),
        courses
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Online Courses"
                subtitle="Courses from connected provider platforms."
            />

            {courses.length > 0 && <UserCoursesStatsGrid summary={summary} />}

            {courses.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                    <BookOpen className="size-10 opacity-40" />
                    <p className="text-sm">
                        No online courses found. Courses from connected
                        providers will appear here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course) => (
                        <Card
                            key={course.id}
                            className="overflow-hidden border-border bg-card shadow-none"
                        >
                            {course.thumbnail_url && (
                                <img
                                    src={course.thumbnail_url}
                                    alt=""
                                    className="h-36 w-full object-cover"
                                />
                            )}
                            <CardContent className="space-y-3 p-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        {course.provider_platform_name}
                                    </p>
                                    <a
                                        href={course.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-foreground hover:underline"
                                    >
                                        {course.course_name}
                                    </a>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Progress</span>
                                        <span>
                                            {Math.floor(course.course_progress)}
                                            %
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-[#556830]"
                                            style={{
                                                width: `${Math.min(100, Math.floor(course.course_progress))}%`
                                            }}
                                        />
                                    </div>
                                </div>

                                {course.grade && (
                                    <p className="text-xs text-muted-foreground">
                                        Grade:{' '}
                                        <span className="font-medium text-foreground">
                                            {course.grade}
                                        </span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
