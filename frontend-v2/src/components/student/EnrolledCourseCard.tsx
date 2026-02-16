import { CheckCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { UserCourses, RecentCourse, CourseStatus, ViewType } from '@/types';

interface EnrolledCourseCardProps {
    course: UserCourses | RecentCourse;
    recent?: boolean;
    view?: ViewType;
}

function formatDateRange(
    startDt?: Date,
    endDt?: Date
): string {
    const fmt = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    const start = startDt ? fmt(startDt) : '';
    const end = endDt ? fmt(endDt) : '';
    if (!start && !end) return '';
    return ` | ${start} - ${end}`;
}

function getStatus(progress: number): CourseStatus | null {
    if (progress === 100) return CourseStatus.Completed;
    return null;
}

export default function EnrolledCourseCard({
    course,
    recent,
    view
}: EnrolledCourseCardProps) {
    const status = getStatus(course.course_progress);
    const dateStr = formatDateRange(course.start_dt, course.end_dt);
    const fullName = course.alt_name
        ? `${course.alt_name} - ${course.course_name}`
        : course.course_name;

    if (view === ViewType.List) {
        return (
            <a
                href={course.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
            >
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center justify-between py-4 px-5">
                        <div className="flex items-center gap-3 min-w-0">
                            <h3 className="font-medium text-foreground truncate">
                                {course.course_name}
                            </h3>
                            <span className="text-muted-foreground">|</span>
                            <p className="text-sm text-muted-foreground truncate">
                                {course.provider_platform_name}
                                {dateStr}
                            </p>
                        </div>
                        <div className="shrink-0 ml-4">
                            {status === CourseStatus.Completed ? (
                                <span className="flex items-center gap-1.5 text-sm text-[#556830] font-medium">
                                    <CheckCircle className="size-4" />
                                    Completed
                                </span>
                            ) : (
                                <div className="w-32 flex items-center gap-2">
                                    <Progress
                                        value={Math.floor(course.course_progress)}
                                        indicatorClassName="bg-[#556830]"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {Math.floor(course.course_progress)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </a>
        );
    }

    return (
        <a
            href={course.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <Card
                className={`overflow-hidden hover:shadow-md transition-shadow ${
                    recent ? 'bg-card' : ''
                }`}
            >
                <div className="h-[124px] bg-muted">
                    {course.thumbnail_url ? (
                        <img
                            src={course.thumbnail_url}
                            alt={fullName}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted" />
                    )}
                </div>
                <CardContent className="p-4 min-h-[140px] relative pb-12">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                        {fullName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {course.provider_platform_name}
                        {dateStr}
                    </p>
                    <div className="absolute bottom-4 left-4 right-4">
                        {status === CourseStatus.Completed ? (
                            <span className="flex items-center gap-1.5 text-sm text-[#556830] font-medium">
                                <CheckCircle className="size-4" />
                                Completed
                            </span>
                        ) : status === CourseStatus.Pending ? (
                            <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                                <Clock className="size-4" />
                                Pending
                            </span>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Progress
                                    value={Math.floor(course.course_progress)}
                                    className="flex-1"
                                    indicatorClassName="bg-[#556830]"
                                />
                                <span className="text-xs text-muted-foreground">
                                    {Math.floor(course.course_progress)}%
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </a>
    );
}
