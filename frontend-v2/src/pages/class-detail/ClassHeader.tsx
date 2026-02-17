import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, AlertCircle } from 'lucide-react';
import { RRule } from 'rrule';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Class } from '@/types/program';
import { EnrollmentAttendance, EnrollmentStatus } from '@/types/attendance';
import { getClassSchedule, getStatusColor } from '@/lib/formatters';

interface ClassHeaderProps {
    cls: Class;
    attendanceRecords: EnrollmentAttendance[];
}

function computeStats(cls: Class, records: EnrollmentAttendance[]) {
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
    const capacityPct =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    return { avgRate, atRiskCount, capacityPct };
}

function getNextClassDate(cls: Class): { date: string; time: string } | null {
    const event = cls.events?.find((e) => !e.is_cancelled);
    if (!event) return null;
    try {
        const cleaned = event.recurrence_rule.replace(
            /DTSTART;TZID=[^:]+:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleaned);
        const now = new Date();
        const next = rule.after(now, true);
        if (!next) return null;
        const date = next.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const h = String(next.getUTCHours()).padStart(2, '0');
        const m = String(next.getUTCMinutes()).padStart(2, '0');
        return { date, time: `${h}:${m}` };
    } catch {
        return null;
    }
}

function formatDate(dt: string): string {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export function ClassHeader({ cls, attendanceRecords }: ClassHeaderProps) {
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const { avgRate, atRiskCount, capacityPct } = useMemo(
        () => computeStats(cls, attendanceRecords),
        [cls, attendanceRecords]
    );
    const nextClass = useMemo(() => getNextClassDate(cls), [cls]);

    const spotsAvailable = cls.capacity - cls.enrolled;

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-2xl font-bold text-[#203622]">
                        {cls.name}
                    </h1>
                    <Badge
                        variant="outline"
                        className={getStatusColor(cls.status)}
                    >
                        {cls.status}
                    </Badge>
                </div>

                <div className="mb-3">
                    <Link
                        to={`/programs/${cls.program_id}`}
                        className="text-[#556830] hover:text-[#203622] hover:underline inline-flex items-center gap-1"
                    >
                        Part of: {cls.program?.name ?? 'Program'} →
                    </Link>
                </div>

                {cls.description && (
                    <p className="text-gray-600 mb-5 max-w-3xl">
                        {cls.description}
                    </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
                    <InfoCard
                        label="Instructor"
                        value={cls.instructor_name || 'Unassigned'}
                    />
                    <InfoCard
                        label="Schedule"
                        value={schedule.days.join(', ') || 'Not set'}
                        sub={
                            schedule.startTime
                                ? `${schedule.startTime} - ${schedule.endTime}`
                                : undefined
                        }
                    />
                    <InfoCard
                        label="Duration"
                        value={formatDate(cls.start_dt) || 'Not set'}
                        sub={
                            cls.end_dt
                                ? `to ${formatDate(cls.end_dt)}`
                                : undefined
                        }
                    />
                    <InfoCard
                        label="Room"
                        value={schedule.room || 'Not assigned'}
                    />
                    <InfoCard
                        label="Next Class"
                        value={nextClass?.date ?? 'None scheduled'}
                        sub={nextClass?.time}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="size-5 text-[#556830]" />
                        <h3 className="text-[#203622] font-semibold">
                            Enrollment
                        </h3>
                    </div>
                    <div className="text-3xl text-[#203622] mb-2">
                        {cls.enrolled} / {cls.capacity}
                    </div>
                    <Progress
                        value={capacityPct}
                        className="h-2 bg-gray-200 mb-3"
                        indicatorClassName={cn(
                            capacityPct >= 75
                                ? 'bg-[#556830]'
                                : capacityPct >= 40
                                  ? 'bg-[#F1B51C]'
                                  : 'bg-red-500'
                        )}
                    />
                    <div className="text-sm text-gray-500">
                        {spotsAvailable}{' '}
                        {spotsAvailable === 1 ? 'spot' : 'spots'} available
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="size-5 text-[#556830]" />
                        <h3 className="text-[#203622] font-semibold">
                            Attendance
                        </h3>
                    </div>
                    <div className="text-3xl text-[#203622] mb-2">
                        {avgRate}%
                    </div>
                    <Progress
                        value={avgRate}
                        className="h-2 bg-gray-200 mb-3"
                        indicatorClassName={cn(
                            avgRate >= 85 ? 'bg-[#556830]' : 'bg-[#F1B51C]'
                        )}
                    />
                    <div className="text-sm text-gray-500">
                        Average attendance rate
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="size-5 text-[#F1B51C]" />
                        <h3 className="text-[#203622] font-semibold">
                            At-Risk Residents
                        </h3>
                    </div>
                    <div className="text-3xl text-[#203622] mb-2">
                        {atRiskCount}
                    </div>
                    <div className="text-sm text-gray-500">
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
    sub
}: {
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="bg-[#E2E7EA]/60 rounded-lg p-3 border-l-2 border-gray-300">
            <div className="text-sm text-gray-500 mb-1">{label}</div>
            <div className="text-[#203622] text-sm font-medium">{value}</div>
            {sub && (
                <div className="text-xs text-gray-500 mt-1">{sub}</div>
            )}
        </div>
    );
}
