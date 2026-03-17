import { useMemo, useState } from 'react';
import { Users, Calendar, AlertCircle, Edit, MapPin } from 'lucide-react';
import { RRule } from 'rrule';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Class } from '@/types/program';
import { Attendance, SelectedClassStatus } from '@/types/attendance';
import { ClassEventInstance } from '@/types/events';
import { getClassSchedule, getStatusColor, formatDate } from '@/lib/formatters';
import { computeAttendanceByUser } from '@/lib/attendance-utils';
import { ChangeClassStatusModal } from './ChangeClassStatusModal';

interface ClassHeaderProps {
    cls: Class;
    onMutate: () => void;
}

interface StatCardsProps {
    cls: Class;
    eventInstances: ClassEventInstance[];
}

function computeStats(cls: Class, instances: ClassEventInstance[]) {
    const attendanceMap = computeAttendanceByUser(instances);

    let totalRate = 0;
    let userCount = 0;
    let atRiskCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    attendanceMap.forEach((stats, userId) => {
        if (stats.total === 0) return;
        totalRate += stats.rate;
        userCount++;

        let consecutive = 0;
        const userRecords: { date: string; status: Attendance }[] = [];
        for (const inst of instances) {
            if (inst.is_cancelled) continue;
            const [y, m, d] = inst.date.split('-').map(Number);
            if (new Date(y, m - 1, d) > today) continue;
            for (const rec of inst.attendance_records ?? []) {
                if (rec.user_id === userId) {
                    userRecords.push({
                        date: inst.date,
                        status: rec.attendance_status
                    });
                }
            }
        }
        userRecords.sort((a, b) => a.date.localeCompare(b.date));
        for (let i = userRecords.length - 1; i >= 0; i--) {
            const s = userRecords[i];
            if (
                s?.status === Attendance.Absent_Excused ||
                s?.status === Attendance.Absent_Unexcused
            ) {
                consecutive++;
            } else {
                break;
            }
        }

        if (stats.rate < 75 || consecutive >= 2) {
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

export function ClassHeader({ cls, onMutate }: ClassHeaderProps) {
    const [showStatusModal, setShowStatusModal] = useState(false);
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const nextClass = useMemo(() => getNextClassDate(cls), [cls]);

    const isTerminal =
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled;

    return (
        <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-[#203622] break-words">
                    {cls.name}
                </h1>
                {isTerminal ? (
                    <Badge
                        variant="outline"
                        className={getStatusColor(cls.status)}
                    >
                        {cls.status}
                    </Badge>
                ) : (
                    <button onClick={() => setShowStatusModal(true)} className="outline-none">
                        <Badge
                            variant="outline"
                            className={`${getStatusColor(cls.status)} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5`}
                        >
                            {cls.status}
                            <Edit className="size-3" />
                        </Badge>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 mb-3">
                <MapPin className="size-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                    <span className="font-medium">
                        {cls.facility?.name ?? cls.facility_name ?? 'Unknown Facility'}
                    </span>
                </span>
            </div>

            {cls.description && (
                <p className="text-gray-600 mb-4 max-w-3xl">
                    {cls.description}
                </p>
            )}

            <div className="grid grid-cols-5 gap-4">
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
                    smallValue
                />
                <InfoCard
                    label="Duration"
                    value={
                        cls.start_dt
                            ? cls.end_dt
                                ? `${formatDate(cls.start_dt)} - ${formatDate(cls.end_dt)}`
                                : `${formatDate(cls.start_dt)} - Ongoing`
                            : 'Not set'
                    }
                />
                <InfoCard
                    label="Room"
                    value={schedule.room || 'Not assigned'}
                    smallValue
                />
                <InfoCard
                    label="Next Class"
                    value={nextClass?.date ?? 'None scheduled'}
                    sub={nextClass?.time}
                    smallValue
                />
            </div>

            <ChangeClassStatusModal
                open={showStatusModal}
                onClose={() => setShowStatusModal(false)}
                classId={cls.id}
                programId={cls.program_id}
                className={cls.name}
                currentStatus={cls.status}
                capacity={cls.capacity}
                onStatusChanged={onMutate}
            />
        </div>
    );
}

export function StatCards({ cls, eventInstances }: StatCardsProps) {
    const { avgRate, atRiskCount, capacityPct } = useMemo(
        () => computeStats(cls, eventInstances),
        [cls, eventInstances]
    );
    const spotsAvailable = cls.capacity - cls.enrolled;

    return (
        <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="size-5 text-[#556830] shrink-0" />
                    <h3 className="text-[#203622] truncate">
                        Enrollment
                    </h3>
                </div>
                <div className="text-3xl text-[#203622] mb-2">
                    {cls.enrolled} / {cls.capacity}
                </div>
                <Progress
                    value={capacityPct}
                    className="h-2 mb-3"
                    indicatorClassName={
                        capacityPct >= 80
                            ? 'bg-[#556830]'
                            : capacityPct >= 50
                              ? 'bg-[#F1B51C]'
                              : 'bg-gray-400'
                    }
                />
                <div className="text-sm text-gray-600">
                    {spotsAvailable}{' '}
                    {spotsAvailable === 1 ? 'spot' : 'spots'} available
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="size-5 text-[#556830] shrink-0" />
                    <h3 className="text-[#203622] truncate">
                        Attendance
                    </h3>
                </div>
                <div className="text-3xl text-[#203622] mb-2">
                    {avgRate}%
                </div>
                <Progress
                    value={avgRate}
                    className="h-2 mb-3"
                    indicatorClassName={
                        avgRate >= 85 ? 'bg-[#556830]' : 'bg-[#F1B51C]'
                    }
                />
                <div className="text-sm text-gray-600">
                    Average attendance rate
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="size-5 text-[#F1B51C] shrink-0" />
                    <h3 className="text-[#203622] truncate">
                        At-Risk Residents
                    </h3>
                </div>
                <div className="text-3xl text-[#203622] mb-2">
                    {atRiskCount}
                </div>
                <div className="text-sm text-gray-600">
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
    );
}

function InfoCard({
    label,
    value,
    sub,
    smallValue
}: {
    label: string;
    value: string;
    sub?: string;
    smallValue?: boolean;
}) {
    return (
        <div className="bg-[#E2E7EA] rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">{label}</div>
            <div className={`text-[#203622]${smallValue ? ' text-sm' : ''}`}>
                {value}
            </div>
            {sub && (
                <div className="text-xs text-gray-600 mt-1">{sub}</div>
            )}
        </div>
    );
}
