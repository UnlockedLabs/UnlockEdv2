import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    Calendar,
    Clock,
    MapPin,
    CalendarOff,
    CalendarClock,
    CheckCircle,
    Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import API from '@/api/api';
import { toast } from 'sonner';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { getClassSchedule, ClassScheduleInfo, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CancelSessionModal } from './CancelSessionModal';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import {
    ChangeInstructorModal,
    ChangeInstructorSession
} from './ChangeInstructorModal';
import { ChangeRoomModal, ChangeRoomSession } from './ChangeRoomModal';

interface ScheduleTabProps {
    cls: Class;
    onClassMutate: () => void;
}

interface CalendarDay {
    date: Date;
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isClassDay: boolean;
    isCancelled: boolean;
    cancellationReason?: string;
    isRescheduledFrom: boolean;
    isRescheduledTo: boolean;
    rescheduledDate?: string;
    rescheduledToDate?: string;
    eventId: number | null;
    overrideId?: number;
    hasAttendance: boolean;
}

function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseOverrideDate(rrule: string): string | null {
    const match = /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/.exec(rrule);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function generateCalendarGrid(
    year: number,
    month: number,
    schedule: ClassScheduleInfo,
    cls: Class,
    instancesByDate: Map<string, ClassEventInstance>
): CalendarDay[][] {
    const todayStr = toLocalDateStr(new Date());
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    const calendarStart = new Date(startOfMonth);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

    const cancelledDates = new Set<string>();
    const cancelOverrideIds = new Map<string, number>();
    const cancelReasons = new Map<string, string>();
    const rescheduleFromTo = new Map<string, { date: string; overrideId: number }>();
    const rescheduleToFrom = new Map<string, { date: string; overrideId: number }>();

    for (const event of cls.events) {
        if (event.is_cancelled) continue;

        const cancelledOverrides = new Map<number, { date: string; id: number; reason: string }>();
        const rescheduledOverrides = new Map<number, { date: string; id: number }>();

        for (const override of event.overrides ?? []) {
            const date = parseOverrideDate(override.override_rrule);
            if (!date) continue;

            if (override.is_cancelled && override.reason === 'rescheduled') {
                cancelledOverrides.set(override.id, { date, id: override.id, reason: override.reason });
            } else if (!override.is_cancelled && override.linked_override_event_id) {
                rescheduledOverrides.set(override.linked_override_event_id, { date, id: override.id });
            } else if (override.is_cancelled) {
                cancelledDates.add(date);
                cancelOverrideIds.set(date, override.id);
                if (override.reason) cancelReasons.set(date, override.reason);
            }
        }

        for (const [cancelledId, cancelled] of cancelledOverrides) {
            const rescheduled = rescheduledOverrides.get(cancelledId);
            if (rescheduled) {
                rescheduleFromTo.set(cancelled.date, { date: rescheduled.date, overrideId: rescheduled.id });
                rescheduleToFrom.set(rescheduled.date, { date: cancelled.date, overrideId: rescheduled.id });
            } else {
                cancelledDates.add(cancelled.date);
                cancelOverrideIds.set(cancelled.date, cancelled.id);
                if (cancelled.reason) cancelReasons.set(cancelled.date, cancelled.reason);
            }
        }
    }

    const weeks: CalendarDay[][] = [];
    const current = new Date(calendarStart);

    for (let week = 0; week < 6; week++) {
        if (week > 4 && current > endOfMonth) break;
        const weekDays: CalendarDay[] = [];
        for (let day = 0; day < 7; day++) {
            const dateStr = toLocalDateStr(current);
            const dayName = current.toLocaleDateString('en-US', {
                weekday: 'long'
            });
            const isClassDay = schedule.days.includes(dayName);
            const startDt = cls.start_dt.split('T')[0];
            const endDt = cls.end_dt ? cls.end_dt.split('T')[0] : '';
            const isInRange =
                dateStr >= startDt &&
                (!endDt || dateStr <= endDt);

            const instance = instancesByDate.get(dateStr);
            const eventId =
                instance?.event_id ??
                cls.events?.find((e) => !e.is_cancelled)?.id ??
                null;
            const hasAttendance =
                (instance?.attendance_records?.length ?? 0) > 0;

            const rawFrom = rescheduleFromTo.has(dateStr);
            const rawTo = rescheduleToFrom.has(dateStr);
            const isRescheduledFrom = rawFrom && !rawTo;
            const isRescheduledTo = rawTo;
            const isCancelled =
                !isRescheduledFrom &&
                !isRescheduledTo &&
                (cancelledDates.has(dateStr) ||
                    (instance?.is_cancelled ?? false));

            const rescheduledDate = isRescheduledFrom
                ? rescheduleFromTo.get(dateStr)!.date
                : isRescheduledTo
                  ? rescheduleToFrom.get(dateStr)!.date
                  : undefined;
            const rescheduledToDate = rawFrom
                ? rescheduleFromTo.get(dateStr)!.date
                : undefined;

            const overrideId = isRescheduledTo
                ? rescheduleToFrom.get(dateStr)!.overrideId
                : isRescheduledFrom
                  ? rescheduleFromTo.get(dateStr)!.overrideId
                  : isCancelled
                    ? cancelOverrideIds.get(dateStr)
                    : undefined;

            weekDays.push({
                date: new Date(current),
                dateStr,
                dayNum: current.getDate(),
                isCurrentMonth: current.getMonth() === month,
                isToday: dateStr === todayStr,
                isClassDay: (isClassDay && isInRange) || isRescheduledTo,
                isCancelled,
                cancellationReason: isCancelled ? cancelReasons.get(dateStr) : undefined,
                isRescheduledFrom,
                isRescheduledTo,
                rescheduledDate,
                rescheduledToDate,
                eventId,
                overrideId,
                hasAttendance
            });
            current.setDate(current.getDate() + 1);
        }
        weeks.push(weekDays);
    }

    return weeks;
}

const CANCEL_REASON_LABELS: Record<string, string> = {
    instructor_unavailable: 'Instructor Unavailable',
    instructor_illness: 'Instructor Illness',
    facility_issue_or_lockdown: 'Facility Issue or Lockdown',
    holiday_or_scheduled_break: 'Holiday or Scheduled Break',
    technology_issue: 'Technology Issue'
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleTab({ cls, onClassMutate }: ScheduleTabProps) {
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const [viewDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [cancelTarget, setCancelTarget] = useState<CalendarDay | null>(null);
    const [rescheduleTarget, setRescheduleTarget] =
        useState<CalendarDay | null>(null);
    const [changeInstructorTarget, setChangeInstructorTarget] =
        useState<CalendarDay | null>(null);
    const [changeRoomTarget, setChangeRoomTarget] =
        useState<CalendarDay | null>(null);

    const [yyyy, mm] = [viewDate.getFullYear(), viewDate.getMonth() + 1];
    const { data: instancesResp, mutate } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(
        `/api/program-classes/${cls.id}/events?month=${String(mm).padStart(2, '0')}&year=${yyyy}`
    );

    const instancesByDate = useMemo(() => {
        const map = new Map<string, ClassEventInstance>();
        for (const inst of instancesResp?.data ?? []) {
            map.set(inst.date, inst);
        }
        return map;
    }, [instancesResp]);

    const calendarWeeks = useMemo(
        () =>
            generateCalendarGrid(
                viewDate.getFullYear(),
                viewDate.getMonth(),
                schedule,
                cls,
                instancesByDate
            ),
        [viewDate, schedule, cls, instancesByDate]
    );

    const monthLabel = viewDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedIsPast = selectedDay
        ? selectedDay.date < today && !selectedDay.isToday
        : false;
    const selectedIsUpcoming = selectedDay
        ? selectedDay.date > today
        : false;
    const canModify =
        selectedDay &&
        !selectedDay.hasAttendance &&
        !selectedDay.isCancelled &&
        !selectedDay.isRescheduledFrom &&
        !selectedDay.rescheduledToDate;

    const classTime = schedule.startTime
        ? `${schedule.startTime} - ${schedule.endTime}`
        : 'Not set';

    const handleUndoOverride = async (overrideId: number) => {
        const resp = await API.delete(
            `program-classes/${cls.id}/events/${overrideId}`
        );
        if (resp.success) {
            toast.success(
                selectedDay?.isRescheduledFrom || selectedDay?.isRescheduledTo
                    ? 'Reschedule undone'
                    : 'Cancellation undone'
            );
        }
        setSelectedDay(null);
        void mutate();
        onClassMutate();
    };

    const getStatusBadge = (day: CalendarDay) => {
        if (day.isCancelled) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-700 border-gray-300"
                >
                    Cancelled
                </Badge>
            );
        }
        if (day.isRescheduledFrom) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-600 border-gray-300"
                >
                    Rescheduled
                </Badge>
            );
        }
        if (day.isRescheduledTo) {
            return (
                <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-300"
                >
                    Rescheduled Class
                </Badge>
            );
        }
        if (day.hasAttendance) {
            return (
                <Badge
                    variant="outline"
                    className="bg-green-50 text-[#556830] border-green-200"
                >
                    Completed
                </Badge>
            );
        }
        if (selectedIsUpcoming) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-50 text-gray-600 border-gray-200"
                >
                    Scheduled
                </Badge>
            );
        }
        if (selectedIsPast) {
            return (
                <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200"
                >
                    Missing Attendance
                </Badge>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[#203622] mb-1">
                        Recurring Schedule Pattern
                    </h3>
                    <p className="text-sm text-gray-600">
                        Reference for the regular class schedule. To manage
                        specific sessions, use the Sessions tab.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-4 p-4 bg-[#E2E7EA] rounded-lg">
                        <Calendar className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-[#203622] mb-1">
                                Regular Sessions
                            </div>
                            <div className="text-sm text-gray-600">
                                {schedule.days.join(', ')} at{' '}
                                {schedule.startTime} - {schedule.endTime}
                            </div>
                            {schedule.room && (
                                <div className="text-sm text-gray-600 mt-1">
                                    {schedule.room}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-[#E2E7EA] rounded-lg">
                        <Clock className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-[#203622] mb-1">
                                Duration
                            </div>
                            <div className="text-sm text-gray-600">
                                {formatDate(cls.start_dt)} to{' '}
                                {cls.end_dt
                                    ? formatDate(cls.end_dt)
                                    : 'Ongoing'}
                            </div>
                            {cls.credit_hours > 0 && (
                                <div className="text-sm text-gray-600 mt-1">
                                    {cls.credit_hours} total credit hours
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[#203622]">
                            {monthLabel}
                        </h4>
                        <p className="text-sm text-gray-600">
                            Click any date to view or modify that session
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="min-w-[500px] border border-gray-200 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-7 bg-gray-100">
                                {DAY_HEADERS.map((d) => (
                                    <div
                                        key={d}
                                        className="py-2 text-center text-xs font-medium text-gray-600"
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>
                            {calendarWeeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7">
                                    {week.map((day) => {
                                        const showAsClass = (day.isClassDay || day.isRescheduledTo) && !day.isCancelled && !day.isRescheduledFrom;
                                        const isClickable = (day.isClassDay || day.isRescheduledTo || day.isCancelled || day.isRescheduledFrom) && day.isCurrentMonth;

                                        return (
                                            <div
                                                key={day.dateStr}
                                                onClick={() => {
                                                    if (isClickable)
                                                        setSelectedDay(day);
                                                }}
                                                className={cn(
                                                    'min-h-[80px] p-2 border-t border-r border-gray-200 last:border-r-0 transition-all',
                                                    !day.isCurrentMonth && 'bg-gray-50',
                                                    day.isToday && 'bg-blue-50',
                                                    showAsClass && day.isCurrentMonth && 'bg-green-50',
                                                    isClickable && 'cursor-pointer hover:ring-2 hover:ring-[#556830] hover:ring-inset',
                                                    selectedDay?.dateStr === day.dateStr && 'ring-2 ring-inset ring-[#556830]'
                                                )}
                                            >
                                                <div className="flex flex-col h-full">
                                                    <span className={cn(
                                                        'text-sm',
                                                        !day.isCurrentMonth && 'text-gray-400',
                                                        day.isCurrentMonth && !day.isClassDay && 'text-gray-700',
                                                        day.isToday && 'font-bold text-blue-700'
                                                    )}>
                                                        {day.dayNum}
                                                    </span>

                                                    {day.isCancelled && day.isCurrentMonth && (
                                                        <div className="mt-1">
                                                            <div className="text-xs bg-gray-200 text-gray-500 rounded px-1.5 py-0.5 inline-block line-through">
                                                                Class
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">Cancelled</div>
                                                        </div>
                                                    )}

                                                    {day.isRescheduledFrom && day.isCurrentMonth && (
                                                        <div className="mt-1">
                                                            <div className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 inline-block line-through">
                                                                Class
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Moved to{' '}
                                                                {day.rescheduledDate
                                                                    ? new Date(
                                                                          day.rescheduledDate + 'T00:00:00'
                                                                      ).toLocaleDateString('en-US', {
                                                                          month: 'short',
                                                                          day: 'numeric'
                                                                      })
                                                                    : ''}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {showAsClass && day.isCurrentMonth && (
                                                        <div className="mt-1">
                                                            <div className="text-xs bg-[#556830] text-white rounded px-1.5 py-0.5 inline-block">
                                                                Class
                                                            </div>
                                                            <div className="text-xs text-gray-600 mt-1">
                                                                {classTime}
                                                            </div>
                                                            {day.isRescheduledTo && (
                                                                <div className="text-xs text-blue-600 mt-0.5">
                                                                    (Rescheduled)
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
                            <span>Regular Class Day</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded" />
                            <span>Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded" />
                            <span>Attendance Recorded</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded" />
                            <span>Cancelled</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-100 border border-gray-300 border-dashed rounded" />
                            <span>Rescheduled</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Detail Sheet */}
            <Sheet
                open={!!selectedDay}
                onOpenChange={(open) => !open && setSelectedDay(null)}
            >
                <SheetContent className="w-[400px] sm:w-[500px] p-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Class Instance Details</SheetTitle>
                        <SheetDescription>
                            View and manage this class instance
                        </SheetDescription>
                    </SheetHeader>

                    {selectedDay && (
                        <>
                            <div className="border-b border-gray-200 px-6 py-4">
                                <div>
                                    <h3
                                        className={`text-[#203622] mb-2 ${selectedDay.isCancelled || selectedDay.isRescheduledFrom ? 'line-through' : ''}`}
                                    >
                                        {selectedDay.date.toLocaleDateString(
                                            'en-US',
                                            {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            }
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedDay)}
                                        {selectedDay.isToday && (
                                            <span className="text-sm text-blue-600">
                                                Today&apos;s class
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-6 space-y-6">
                                <div>
                                    <h4 className="text-sm text-gray-700 mb-3">
                                        Class Details
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Calendar className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">
                                                    Class
                                                </div>
                                                <div className="text-[#203622]">
                                                    {cls.name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">
                                                    Time
                                                </div>
                                                <div
                                                    className={`text-[#203622] ${selectedDay.isCancelled || selectedDay.isRescheduledFrom ? 'line-through' : ''}`}
                                                >
                                                    {classTime}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">
                                                    Room
                                                </div>
                                                <div
                                                    className={`text-[#203622] ${selectedDay.isCancelled || selectedDay.isRescheduledFrom ? 'line-through' : ''}`}
                                                >
                                                    {schedule.room ||
                                                        'Not assigned'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(selectedDay.isCancelled ||
                                    selectedDay.isRescheduledFrom ||
                                    selectedDay.isRescheduledTo ||
                                    selectedDay.hasAttendance) && (
                                    <div className="pt-6 border-t border-gray-200">
                                        <h4 className="text-sm text-gray-700 mb-3">
                                            Status
                                        </h4>

                                        {selectedDay.isCancelled && (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-gray-900 mb-1">
                                                            Class Cancelled
                                                        </div>
                                                        {selectedDay.cancellationReason && (
                                                            <p className="text-sm text-gray-600">
                                                                {CANCEL_REASON_LABELS[selectedDay.cancellationReason] ?? selectedDay.cancellationReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {selectedDay.overrideId && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            void handleUndoOverride(
                                                                selectedDay.overrideId!
                                                            );
                                                        }}
                                                        className="w-full"
                                                    >
                                                        Undo Cancellation
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {selectedDay.isRescheduledFrom &&
                                            !selectedDay.isRescheduledTo &&
                                            selectedDay.rescheduledDate && (
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-2">
                                                        <CalendarClock className="size-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm text-gray-900 mb-1">
                                                                Class
                                                                Rescheduled
                                                            </div>
                                                            <p className="text-sm text-gray-600">
                                                                Moved to{' '}
                                                                {new Date(
                                                                    selectedDay.rescheduledDate +
                                                                        'T00:00:00'
                                                                ).toLocaleDateString(
                                                                    'en-US',
                                                                    {
                                                                        weekday:
                                                                            'long',
                                                                        month: 'long',
                                                                        day: 'numeric'
                                                                    }
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedDay.overrideId && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                void handleUndoOverride(
                                                                    selectedDay.overrideId!
                                                                );
                                                            }}
                                                            className="w-full"
                                                        >
                                                            Undo Reschedule
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                        {selectedDay.isRescheduledTo &&
                                            selectedDay.rescheduledDate && (
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-2">
                                                        <CalendarClock className={`size-4 mt-0.5 flex-shrink-0 ${selectedDay.rescheduledToDate ? 'text-gray-500' : 'text-blue-700'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm text-gray-900 mb-1">
                                                                {selectedDay.rescheduledToDate
                                                                    ? 'Class Rescheduled'
                                                                    : 'Rescheduled Class'}
                                                            </div>
                                                            <p className="text-sm text-gray-600">
                                                                {selectedDay.rescheduledToDate
                                                                    ? `Moved to ${new Date(
                                                                          selectedDay.rescheduledToDate +
                                                                              'T00:00:00'
                                                                      ).toLocaleDateString(
                                                                          'en-US',
                                                                          {
                                                                              weekday:
                                                                                  'long',
                                                                              month: 'long',
                                                                              day: 'numeric'
                                                                          }
                                                                      )}`
                                                                    : `Originally scheduled for ${new Date(
                                                                          selectedDay.rescheduledDate +
                                                                              'T00:00:00'
                                                                      ).toLocaleDateString(
                                                                          'en-US',
                                                                          {
                                                                              weekday:
                                                                                  'long',
                                                                              month: 'long',
                                                                              day: 'numeric'
                                                                          }
                                                                      )}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedDay.overrideId && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                void handleUndoOverride(
                                                                    selectedDay.overrideId!
                                                                );
                                                            }}
                                                            className="w-full"
                                                        >
                                                            Undo Reschedule
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                        {selectedDay.hasAttendance && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="size-4 text-[#556830] mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-[#556830] mb-1">
                                                            Attendance Taken
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            This class cannot be
                                                            modified because
                                                            attendance has been
                                                            recorded.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {canModify && (
                                    <div className="pt-6 border-t border-gray-200">
                                        <h4 className="text-sm text-gray-700 mb-3">
                                            Actions
                                        </h4>
                                        <div className="space-y-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setRescheduleTarget(
                                                        selectedDay
                                                    );
                                                }}
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <CalendarClock className="size-4 mr-2" />
                                                Reschedule This Class
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setCancelTarget(
                                                        selectedDay
                                                    );
                                                }}
                                                className="w-full justify-start border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                            >
                                                <CalendarOff className="size-4 mr-2" />
                                                Cancel This Class
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setChangeInstructorTarget(
                                                        selectedDay
                                                    );
                                                }}
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <Users className="size-4 mr-2" />
                                                Change Instructor
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setChangeRoomTarget(
                                                        selectedDay
                                                    );
                                                }}
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <MapPin className="size-4 mr-2" />
                                                Change Room
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {cancelTarget?.eventId && (
                <CancelSessionModal
                    open={!!cancelTarget}
                    onClose={() => setCancelTarget(null)}
                    classId={cls.id}
                    eventId={cancelTarget.eventId}
                    date={cancelTarget.dateStr}
                    dateLabel={cancelTarget.date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                    onCancelled={() => {
                        setSelectedDay(null);
                        void mutate();
                        onClassMutate();
                    }}
                />
            )}

            {rescheduleTarget?.eventId && (
                <RescheduleSessionModal
                    open={!!rescheduleTarget}
                    onClose={() => setRescheduleTarget(null)}
                    classId={cls.id}
                    eventId={rescheduleTarget.eventId}
                    originalDate={rescheduleTarget.dateStr}
                    dateLabel={rescheduleTarget.date.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    currentRoom={schedule.room}
                    classTime={classTime}
                    onRescheduled={() => {
                        setSelectedDay(null);
                        void mutate();
                        onClassMutate();
                    }}
                />
            )}

            {changeInstructorTarget?.eventId && (
                <ChangeInstructorModal
                    open={!!changeInstructorTarget}
                    onClose={() => setChangeInstructorTarget(null)}
                    classId={cls.id}
                    sessions={[
                        {
                            date: changeInstructorTarget.dateStr,
                            dateLabel: changeInstructorTarget.date.toLocaleDateString(
                                'en-US',
                                {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                }
                            ),
                            eventId: changeInstructorTarget.eventId,
                            classTime
                        }
                    ]}
                    onChanged={() => {
                        setSelectedDay(null);
                        void mutate();
                        onClassMutate();
                    }}
                />
            )}

            {changeRoomTarget?.eventId && (
                <ChangeRoomModal
                    open={!!changeRoomTarget}
                    onClose={() => setChangeRoomTarget(null)}
                    classId={cls.id}
                    sessions={[
                        {
                            date: changeRoomTarget.dateStr,
                            dateLabel: changeRoomTarget.date.toLocaleDateString(
                                'en-US',
                                {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                }
                            ),
                            eventId: changeRoomTarget.eventId,
                            classTime
                        }
                    ]}
                    onChanged={() => {
                        setSelectedDay(null);
                        void mutate();
                        onClassMutate();
                    }}
                />
            )}
        </div>
    );
}
