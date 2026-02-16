import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, AlertCircle, Clock, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Class } from '@/types/program';
import { EnrollmentAttendance, EnrollmentStatus } from '@/types/attendance';
import { getClassSchedule, getStatusColor } from '@/lib/formatters';

interface ClassHeaderProps {
    cls: Class;
    attendanceRecords: EnrollmentAttendance[];
}

function computeStats(
    cls: Class,
    records: EnrollmentAttendance[]
) {
    const enrolledRecords = records.filter(
        (r) => r.enrollment_status === EnrollmentStatus.Enrolled
    );

    const byUser = new Map<number, EnrollmentAttendance[]>();
    for (const r of enrolledRecords) {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r);
        byUser.set(r.user_id, arr);
    }

    let totalRate = 0;
    let userCount = 0;
    let atRiskCount = 0;

    byUser.forEach((userRecords) => {
        const withStatus = userRecords.filter((r) => r.attendance_status);
        const total = withStatus.length;
        if (total === 0) return;

        const attended = withStatus.filter(
            (r) =>
                r.attendance_status === 'present' ||
                r.attendance_status === 'partial'
        ).length;

        const rate = Math.round((attended / total) * 100);
        totalRate += rate;
        userCount++;

        const sorted = [...withStatus].sort((a, b) =>
            (a.date ?? '').localeCompare(b.date ?? '')
        );
        let consecutive = 0;
        for (let i = sorted.length - 1; i >= 0; i--) {
            const s = sorted[i];
            if (
                s?.attendance_status === 'absent_excused' ||
                s?.attendance_status === 'absent_unexcused'
            ) {
                consecutive++;
            } else {
                break;
            }
        }

        if (rate < 75 || consecutive >= 2) {
            atRiskCount++;
        }
    });

    const avgRate = userCount > 0 ? Math.round(totalRate / userCount) : 0;
    const capacityPct = cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    return { avgRate, atRiskCount, capacityPct };
}

export function ClassHeader({ cls, attendanceRecords }: ClassHeaderProps) {
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const { avgRate, atRiskCount, capacityPct } = useMemo(
        () => computeStats(cls, attendanceRecords),
        [cls, attendanceRecords]
    );

    const spotsAvailable = cls.capacity - cls.enrolled;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="text-2xl font-bold text-foreground">
                            {cls.name}
                        </h1>
                        <Badge
                            variant="outline"
                            className={getStatusColor(cls.status)}
                        >
                            {cls.status}
                        </Badge>
                    </div>

                    <div className="mb-4">
                        <Link
                            to={`/programs/${cls.program_id}`}
                            className="text-[#556830] hover:text-foreground hover:underline inline-flex items-center gap-1"
                        >
                            Part of: {cls.program?.name ?? 'Program'} →
                        </Link>
                    </div>

                    {cls.description && (
                        <p className="text-muted-foreground mb-4 max-w-3xl">
                            {cls.description}
                        </p>
                    )}

                    <div className="grid grid-cols-5 gap-4">
                        <InfoCard
                            label="Instructor"
                            value={cls.instructor_name}
                        />
                        <div className="bg-muted rounded-lg p-3">
                            <div className="text-sm text-muted-foreground mb-1">
                                Schedule
                            </div>
                            <div className="text-foreground text-sm">
                                {schedule.days.join(', ') || 'Not set'}
                            </div>
                            {schedule.startTime && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    {schedule.startTime} - {schedule.endTime}
                                </div>
                            )}
                        </div>
                        <InfoCard
                            label="Duration"
                            value={`${cls.start_dt} to ${cls.end_dt || 'Ongoing'}`}
                        />
                        <InfoCard
                            label="Room"
                            value={schedule.room || 'Not assigned'}
                            icon={<MapPin className="size-3 inline mr-1" />}
                        />
                        <InfoCard
                            label="Credit Hours"
                            value={
                                cls.credit_hours > 0
                                    ? `${cls.credit_hours}`
                                    : 'N/A'
                            }
                            icon={<Clock className="size-3 inline mr-1" />}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="size-5 text-[#556830]" />
                        <h3 className="text-foreground font-semibold">
                            Enrollment
                        </h3>
                    </div>
                    <div className="text-3xl text-foreground mb-2">
                        {cls.enrolled} / {cls.capacity}
                    </div>
                    <Progress
                        value={capacityPct}
                        className="h-2 mb-3"
                        indicatorClassName="bg-[#556830]"
                    />
                    <div className="text-sm text-muted-foreground">
                        {spotsAvailable}{' '}
                        {spotsAvailable === 1 ? 'spot' : 'spots'} available
                    </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="size-5 text-[#556830]" />
                        <h3 className="text-foreground font-semibold">
                            Attendance
                        </h3>
                    </div>
                    <div className="text-3xl text-foreground mb-2">
                        {avgRate}%
                    </div>
                    <Progress
                        value={avgRate}
                        className="h-2 mb-3"
                        indicatorClassName={
                            avgRate >= 85 ? 'bg-[#556830]' : 'bg-[#F1B51C]'
                        }
                    />
                    <div className="text-sm text-muted-foreground">
                        Average attendance rate
                    </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="size-5 text-[#F1B51C]" />
                        <h3 className="text-foreground font-semibold">
                            At-Risk Residents
                        </h3>
                    </div>
                    <div className="text-3xl text-foreground mb-2">
                        {atRiskCount}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {atRiskCount === 0 ? (
                            <span className="text-[#556830]">
                                All residents engaged
                            </span>
                        ) : (
                            <span>
                                Low attendance or consecutive absences
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoCard({
    label,
    value,
    icon
}: {
    label: string;
    value: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="bg-muted rounded-lg p-3">
            <div className="text-sm text-muted-foreground mb-1">{label}</div>
            <div className="text-foreground text-sm">
                {icon}
                {value}
            </div>
        </div>
    );
}
