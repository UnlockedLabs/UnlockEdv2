import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import {
    ServerResponse,
    UserCoursesInfo,
    UserCourses
} from '@/types';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Clock, BookOpen, CheckCircle } from 'lucide-react';

const SORT_OPTIONS = [
    { label: 'Name', value: 'order=asc&order_by=course_name' },
    { label: 'Completed Only', value: 'completed' },
    { label: 'In Progress Only', value: 'in_progress' },
    { label: 'Total Time', value: 'order=desc&order_by=total_time' }
];

function formatTime(seconds: number): string {
    if (seconds < 3600) {
        const minutes = Math.round(seconds / 60);
        return `${minutes} min`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function StatCard({
    icon,
    title,
    value,
    label
}: {
    icon: React.ReactNode;
    title: string;
    value: string;
    label: string;
}) {
    return (
        <Card>
            <CardContent className="p-5 flex items-start gap-4">
                <div className="rounded-lg bg-muted p-2.5 shrink-0">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function MyProgress() {
    const { user } = useAuth();
    const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value);
    const [filter, setFilter] = useState<number>(0);

    if (!user) return null;

    const apiSort =
        sortValue === 'completed' || sortValue === 'in_progress'
            ? 'order=asc&order_by=course_name'
            : sortValue;

    const { data, isLoading, error } = useSWR<ServerResponse<UserCoursesInfo>>(
        `/api/users/${user.id}/courses?${apiSort}`
    );

    const courseData = data?.data as UserCoursesInfo | undefined;

    function handleSortChange(value: string) {
        if (value === 'completed') {
            setFilter(1);
            setSortValue(value);
        } else if (value === 'in_progress') {
            setFilter(-1);
            setSortValue(value);
        } else {
            setFilter(0);
            setSortValue(value);
        }
    }

    const filteredCourses = (courseData?.courses ?? []).filter(
        (course: UserCourses) => {
            if (filter === 1) return course.course_progress === 100;
            if (filter === -1) return course.course_progress < 100;
            return true;
        }
    );

    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader title="My Progress" />

                {isLoading && (
                    <p className="text-muted-foreground text-center py-8">Loading...</p>
                )}

                {!isLoading && !error && courseData && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                icon={
                                    <Clock className="size-5 text-[#556830]" />
                                }
                                title="Total Time"
                                value={Math.floor(
                                    courseData.total_time / 3600
                                ).toString()}
                                label="hours"
                            />
                            <StatCard
                                icon={
                                    <CheckCircle className="size-5 text-[#556830]" />
                                }
                                title="Completed"
                                value={courseData.num_completed.toString()}
                                label="courses"
                            />
                            <StatCard
                                icon={
                                    <BookOpen className="size-5 text-[#556830]" />
                                }
                                title="In Progress"
                                value={courseData.num_in_progress.toString()}
                                label="courses"
                            />
                        </div>

                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-foreground">
                                        All Courses
                                    </h2>
                                    <Select
                                        value={sortValue}
                                        onValueChange={handleSortChange}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Sort" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SORT_OPTIONS.map((opt) => (
                                                <SelectItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-1/2">
                                                    Course Name
                                                </th>
                                                <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-1/4">
                                                    Status
                                                </th>
                                                <th className="text-left py-2 text-muted-foreground font-medium w-1/4">
                                                    Time Spent
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCourses.map(
                                                (
                                                    course: UserCourses,
                                                    idx: number
                                                ) => (
                                                    <tr
                                                        key={idx}
                                                        className="border-b border-border last:border-0"
                                                    >
                                                        <td className="py-3 pr-4 text-foreground">
                                                            {course.course_name}
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <StatusBadge
                                                                status={
                                                                    course.course_progress ===
                                                                    100
                                                                        ? 'Completed'
                                                                        : 'In Progress'
                                                                }
                                                                className={
                                                                    course.course_progress ===
                                                                    100
                                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                                }
                                                            />
                                                        </td>
                                                        <td className="py-3 text-muted-foreground">
                                                            {formatTime(
                                                                course.total_time
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredCourses.length === 0 && (
                                    <p className="text-muted-foreground text-center py-8">
                                        No courses match the current filter.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
