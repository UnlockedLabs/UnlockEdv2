import { useNavigate, useParams, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Edit, ClipboardList } from 'lucide-react';
import { Class, ClassLoaderData, ServerResponseOne, SelectedClassStatus } from '@/types';
import { getClassSchedule, getInstructorName, getStatusColor, formatTime12h } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <Card className="bg-muted">
            <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground">{value}</p>
            </CardContent>
        </Card>
    );
}

export default function ClassLayout() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const loaderData = useLoaderData() as ClassLoaderData;

    const { data: classResp, isLoading } = useSWR<ServerResponseOne<Class>>(
        class_id ? `/api/program-classes/${class_id}` : null
    );

    const cls = classResp?.data ?? loaderData?.class;

    if (isLoading && !cls) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (!cls) {
        return (
            <div className="text-center py-12">
                <h2 className="text-lg font-semibold text-foreground">
                    Class Not Found
                </h2>
                <p className="text-muted-foreground mt-2">
                    The class you are looking for does not exist.
                </p>
                <Button
                    onClick={() => navigate(-1)}
                    className="mt-4 bg-[#556830] hover:bg-[#203622]"
                >
                    Go Back
                </Button>
            </div>
        );
    }

    const schedule = getClassSchedule(cls);
    const instructorName = getInstructorName(cls.events);
    const enrollPct = cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;
    const attendanceRate = loaderData?.attendance_rate ?? 0;
    const missingAttendance = loaderData?.missing_attendance ?? 0;

    return (
        <div className="space-y-4">
            <Button
                variant="ghost"
                onClick={() => navigate(`/programs/${cls.program_id}`)}
                className="-ml-2 text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4 mr-2" />
                Back to Program
            </Button>

            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-foreground">{cls.name}</h1>
                        <Badge variant="outline" className={getStatusColor(cls.status)}>
                            {cls.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {instructorName && <span>{instructorName}</span>}
                        {schedule.days.length > 0 && (
                            <span>
                                {schedule.days.map((d) => d.slice(0, 3)).join(', ')}
                                {schedule.startTime && ` | ${formatTime12h(schedule.startTime)}`}
                                {schedule.endTime && ` - ${formatTime12h(schedule.endTime)}`}
                            </span>
                        )}
                        {schedule.room && <span>{schedule.room}</span>}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="border-gray-300"
                        onClick={() =>
                            navigate(
                                `/programs/${cls.program_id}/classes/${cls.id}`
                            )
                        }
                    >
                        <Edit className="size-4 mr-2" />
                        Edit Class
                    </Button>
                    {cls.status === SelectedClassStatus.Active && (
                        <Button
                            onClick={() => {
                                const event = cls.events?.find((e) => !e.is_cancelled);
                                if (event) {
                                    const today = new Date().toISOString().split('T')[0];
                                    navigate(
                                        `/program-classes/${cls.id}/events/${event.id}/attendance/${today}`
                                    );
                                }
                            }}
                            className="bg-[#F1B51C] hover:bg-[#d9a419] text-foreground"
                        >
                            <ClipboardList className="size-4 mr-2" />
                            Take Attendance
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
                <StatCard label="Enrolled" value={cls.enrolled} />
                <StatCard label="Capacity" value={cls.capacity} />
                <StatCard
                    label="Enrollment"
                    value={`${Math.round(enrollPct)}%`}
                />
                <StatCard
                    label="Attendance Rate"
                    value={`${Math.round(attendanceRate)}%`}
                />
                <StatCard
                    label="Missing Attendance"
                    value={missingAttendance}
                />
            </div>

            <div className="w-full">
                <Progress
                    value={enrollPct}
                    className="h-2"
                    indicatorClassName="bg-[#556830]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    {cls.enrolled} of {cls.capacity} spots filled
                </p>
            </div>
        </div>
    );
}
