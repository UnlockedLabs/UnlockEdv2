import { useMemo, useState } from 'react';
import { Users, Calendar, AlertCircle, Edit, MapPin } from 'lucide-react';
import { RRule, Weekday } from 'rrule';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Class } from '@/types/program';
import { SelectedClassStatus } from '@/types/attendance';
import {
    getClassSchedule,
    ClassScheduleInfo,
    getInstructorName,
    getStatusColor,
    formatDate,
    formatTime12h,
    formatClassTimeRange,
    timeToMinutes
} from '@/lib/formatters';
import { ChangeClassStatusModal } from './ChangeClassStatusModal';

const CANVAS_WEEKDAY_NAMES: Record<number, string> = {
    0: 'Monday',
    1: 'Tuesday',
    2: 'Wednesday',
    3: 'Thursday',
    4: 'Friday',
    5: 'Saturday',
    6: 'Sunday'
};

function parseGoDuration(duration: string): number {
    const h = /(\d+)h/.exec(duration);
    const m = /(\d+)m/.exec(duration);
    const s = /(\d+)s/.exec(duration);
    return (
        parseInt(h?.[1] ?? '0', 10) * 3600000 +
        parseInt(m?.[1] ?? '0', 10) * 60000 +
        parseInt(s?.[1] ?? '0', 10) * 1000
    );
}

function getCanvasClassSchedule(cls: Class): ClassScheduleInfo {
    const event = cls.events?.find((e) => !e.is_cancelled);
    if (!event) return { days: [], startTime: '', endTime: '', room: '' };

    const tz = cls.canvas_timezone;
    let days: string[] = [];
    let startTime = '';
    let endTime = '';

    try {
        const cleaned = event.recurrence_rule.replace(
            /DTSTART;TZID=[^:]+:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleaned);
        days =
            rule.options.byweekday?.map(
                (d: number | Weekday) =>
                    CANVAS_WEEKDAY_NAMES[
                        typeof d === 'number' ? d : d.weekday
                    ] ?? ''
            ) ?? [];

        if (rule.options.dtstart) {
            const dt = rule.options.dtstart;
            if (tz) {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).formatToParts(dt);
                const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
                const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
                startTime = `${h}:${m}`;
            } else {
                const h = String(dt.getUTCHours()).padStart(2, '0');
                const m = String(dt.getUTCMinutes()).padStart(2, '0');
                startTime = `${h}:${m}`;
            }
        }
    } catch {
        /* rrule parse failure */
    }

    if (startTime && event.duration) {
        const durationMs = parseGoDuration(event.duration);
        if (durationMs > 0) {
            const totalMinutes = timeToMinutes(startTime) + durationMs / 60000;
            const endH = String(Math.floor(totalMinutes / 60) % 24).padStart(
                2,
                '0'
            );
            const endM = String(Math.floor(totalMinutes % 60)).padStart(2, '0');
            endTime = `${endH}:${endM}`;
        }
    }

    return { days, startTime, endTime, room: '' };
}

interface ClassHeaderProps {
    cls: Class;
    onMutate: () => void;
}

interface StatCardsProps {
    cls: Class;
    attendanceRate: number;
    atRiskCount: number;
    isCanvasClass?: boolean;
}

function getNextClassDate(cls: Class): { date: string; time: string } | null {
    const event = cls.events?.find((e) => !e.is_cancelled);
    if (!event) return null;
    const tz =
        cls.canvas_timezone ??
        cls.facility?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
        const cleaned = event.recurrence_rule.replace(
            /DTSTART;TZID=[^:]+:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleaned);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(new Date());
        const get = (t: string) =>
            Number(parts.find((p) => p.type === t)?.value);
        const nowInFacilityTz = new Date(
            Date.UTC(
                get('year'),
                get('month') - 1,
                get('day'),
                get('hour') % 24,
                get('minute'),
                get('second')
            )
        );
        const next = rule.after(nowInFacilityTz, true);
        if (!next) return null;
        const date = next.toLocaleDateString('en-US', {
            timeZone: tz,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const timeParts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(next);
        const h = timeParts.find((p) => p.type === 'hour')?.value ?? '00';
        const m = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
        return { date, time: formatTime12h(`${h}:${m}`) };
    } catch {
        return null;
    }
}

export function ClassHeader({ cls, onMutate }: ClassHeaderProps) {
    const [showStatusModal, setShowStatusModal] = useState(false);
    const schedule = useMemo(
        () =>
            cls.is_canvas ? getCanvasClassSchedule(cls) : getClassSchedule(cls),
        [cls]
    );
    const nextClass = useMemo(() => getNextClassDate(cls), [cls]);

    const isTerminal =
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled;

    const isReadOnly = isTerminal || cls.is_canvas;

    return (
        <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-brand-dark">{cls.name}</h1>
                {isReadOnly ? (
                    <Badge
                        variant="outline"
                        className={getStatusColor(cls.status)}
                    >
                        {cls.status}
                    </Badge>
                ) : (
                    <button
                        onClick={() => setShowStatusModal(true)}
                        className="outline-none"
                    >
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
                        {cls.facility?.name ??
                            cls.facility_name ??
                            'Unknown Facility'}
                    </span>
                </span>
            </div>

            {cls.description && (
                <p className="text-gray-600 mb-4 max-w-3xl">
                    {cls.description}
                </p>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                <InfoCard
                    label="Instructor"
                    value={getInstructorName(cls.events) || 'Unassigned'}
                />
                <InfoCard
                    label="Schedule"
                    value={schedule.days.join(', ') || 'Not set'}
                    sub={
                        schedule.startTime
                            ? formatClassTimeRange(
                                  `${schedule.startTime}-${schedule.endTime}`
                              )
                            : undefined
                    }
                    smallValue
                />
                <InfoCard
                    label="Duration"
                    value={
                        cls.start_dt &&
                        new Date(cls.start_dt).getFullYear() >= 1900
                            ? `${formatDate(cls.start_dt)} to ${cls.end_dt ? formatDate(cls.end_dt) : 'Ongoing'}`
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

export function StatCards({
    cls,
    attendanceRate,
    atRiskCount,
    isCanvasClass = false
}: StatCardsProps) {
    const avgRate = Math.round(attendanceRate);
    const capacityPct =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;
    const spotsAvailable = cls.capacity - cls.enrolled;

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 mb-6">
            <div className="card-block p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="size-5 text-brand shrink-0" />
                    <h3 className="text-brand-dark truncate">Enrollment</h3>
                </div>
                {isCanvasClass ? (
                    <div className="text-3xl text-brand-dark">
                        {cls.enrolled}
                    </div>
                ) : (
                    <>
                        <div className="text-3xl text-brand-dark mb-2">
                            {cls.enrolled} / {cls.capacity}
                        </div>
                        <Progress
                            value={capacityPct}
                            className="h-2 mb-3"
                            indicatorClassName="bg-brand"
                        />
                        <div className="text-sm text-gray-600">
                            {spotsAvailable}{' '}
                            {spotsAvailable === 1 ? 'spot' : 'spots'} available
                        </div>
                    </>
                )}
            </div>

            {!isCanvasClass && (
                <div className="card-block p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="size-5 text-brand shrink-0" />
                        <h3 className="text-brand-dark truncate">Attendance</h3>
                    </div>
                    <div className="text-3xl text-brand-dark mb-2">
                        {avgRate}%
                    </div>
                    <Progress
                        value={avgRate}
                        className="h-2 mb-3"
                        indicatorClassName={
                            avgRate >= 85 ? 'bg-brand' : 'bg-brand-gold'
                        }
                    />
                    <div className="text-sm text-gray-600">
                        Average attendance rate
                    </div>
                </div>
            )}

            <div className="card-block p-6">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="size-5 text-brand-gold shrink-0" />
                    <h3 className="text-brand-dark truncate">
                        At-Risk Residents
                    </h3>
                </div>
                <div className="text-3xl text-brand-dark mb-2">
                    {atRiskCount}
                </div>
                <div className="text-sm text-gray-600">
                    {atRiskCount === 0 ? (
                        <span className="text-brand">
                            All residents engaged
                        </span>
                    ) : (
                        <span>Low attendance or consecutive absences</span>
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
        <div className="bg-surface-hover rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">{label}</div>
            <div className={`text-brand-dark${smallValue ? ' text-sm' : ''}`}>
                {value}
            </div>
            {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
        </div>
    );
}
