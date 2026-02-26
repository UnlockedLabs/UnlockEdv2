import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    Calendar,
    Clock,
    MapPin,
    ChevronLeft,
    ChevronRight,
    CalendarOff,
    CalendarClock,
    CheckCircle
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
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { getClassSchedule, ClassScheduleInfo } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CancelSessionModal } from './CancelSessionModal';
import { RescheduleSessionModal } from './RescheduleSessionModal';

interface ScheduleTabProps {
    cls: Class;
}

interface CalendarDay {
    date: Date;
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isClassDay: boolean;
    isCancelled: boolean;
    eventId: number | null;
    hasAttendance: boolean;
}

function generateCalendarGrid(
    year: number,
    month: number,
    schedule: ClassScheduleInfo,
    cls: Class,
    instancesByDate: Map<string, ClassEventInstance>
): CalendarDay[][] {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    const calendarStart = new Date(startOfMonth);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

    const cancelledDates = new Set<string>();
    for (const event of cls.events) {
        if (event.is_cancelled) continue;
        for (const override of event.overrides ?? []) {
            if (override.is_cancelled) {
                try {
                    const rrule = override.override_rrule;
                    const dtMatch = /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/.exec(
                        rrule
                    );
                    if (dtMatch) {
                        cancelledDates.add(
                            `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`
                        );
                    }
                } catch {
                    /* skip invalid override */
                }
            }
        }
    }

    const weeks: CalendarDay[][] = [];
    const current = new Date(calendarStart);

    for (let week = 0; week < 6; week++) {
        if (week > 4 && current > endOfMonth) break;
        const weekDays: CalendarDay[] = [];
        for (let day = 0; day < 7; day++) {
            const dateStr = current.toISOString().split('T')[0];
            const dayName = current.toLocaleDateString('en-US', {
                weekday: 'long'
            });
            const isClassDay = schedule.days.includes(dayName);
            const isInRange =
                dateStr >= cls.start_dt &&
                (!cls.end_dt || dateStr <= cls.end_dt);

            const instance = instancesByDate.get(dateStr);
            const eventId =
                instance?.event_id ??
                cls.events?.find((e) => !e.is_cancelled)?.id ??
                null;
            const hasAttendance =
                (instance?.attendance_records?.length ?? 0) > 0;

            weekDays.push({
                date: new Date(current),
                dateStr,
                dayNum: current.getDate(),
                isCurrentMonth: current.getMonth() === month,
                isToday: dateStr === todayStr,
                isClassDay: isClassDay && isInRange,
                isCancelled: cancelledDates.has(dateStr),
                eventId,
                hasAttendance
            });
            current.setDate(current.getDate() + 1);
        }
        weeks.push(weekDays);
    }

    return weeks;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleTab({ cls }: ScheduleTabProps) {
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const [viewDate, setViewDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [cancelTarget, setCancelTarget] = useState<CalendarDay | null>(null);
    const [rescheduleTarget, setRescheduleTarget] =
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

    const goToPrevMonth = () => {
        setViewDate(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
        setSelectedDay(null);
    };

    const goToNextMonth = () => {
        setViewDate(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
        setSelectedDay(null);
    };

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
        !selectedIsPast &&
        !selectedDay.isCancelled;

    const classTime = schedule.startTime
        ? `${schedule.startTime} - ${schedule.endTime}`
        : 'Not set';

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
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[#203622] mb-1 font-semibold">
                        Recurring Schedule Pattern
                    </h3>
                    <p className="text-sm text-gray-500">
                        Reference for the regular class schedule. To manage
                        specific sessions, use the Sessions tab.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-4 p-4 bg-[#E2E7EA]/60 rounded-lg">
                        <Calendar className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-[#203622] mb-1 font-medium">
                                Regular Sessions
                            </div>
                            <div className="text-sm text-gray-500">
                                {schedule.days.join(', ')} at{' '}
                                {schedule.startTime} - {schedule.endTime}
                            </div>
                            {schedule.room && (
                                <div className="text-sm text-gray-500 mt-1">
                                    {schedule.room}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-[#E2E7EA]/60 rounded-lg">
                        <Clock className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-[#203622] mb-1 font-medium">
                                Duration
                            </div>
                            <div className="text-sm text-gray-500">
                                {cls.start_dt} to {cls.end_dt || 'Ongoing'}
                            </div>
                            {cls.credit_hours > 0 && (
                                <div className="text-sm text-gray-500 mt-1">
                                    {cls.credit_hours} total credit hours
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToPrevMonth}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <h4 className="text-[#203622] font-medium min-w-[140px] sm:min-w-[180px] text-center">
                                {monthLabel}
                            </h4>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToNextMonth}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-gray-500">
                            Click any class day to view details
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="min-w-[500px] border border-gray-200 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-7 bg-gray-100">
                                {DAY_HEADERS.map((d) => (
                                    <div
                                        key={d}
                                        className="py-2 text-center text-xs font-medium text-gray-500"
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>
                            {calendarWeeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7">
                                    {week.map((day) => (
                                        <button
                                            key={day.dateStr}
                                            onClick={() => {
                                                if (day.isClassDay)
                                                    setSelectedDay(day);
                                            }}
                                            disabled={!day.isClassDay}
                                            className={cn(
                                                'h-12 text-sm border-t border-r border-gray-200 last:border-r-0 flex items-center justify-center relative transition-colors',
                                                !day.isCurrentMonth &&
                                                    'text-gray-500',
                                                day.isCurrentMonth &&
                                                    !day.isClassDay &&
                                                    'text-gray-500',
                                                day.isClassDay &&
                                                    !day.isCancelled &&
                                                    'bg-green-50 text-[#556830] font-medium hover:bg-green-100 cursor-pointer',
                                                day.isClassDay &&
                                                    day.isCancelled &&
                                                    'bg-gray-100 text-gray-500 line-through cursor-pointer hover:bg-gray-200',
                                                day.isToday &&
                                                    'ring-2 ring-inset ring-blue-400',
                                                selectedDay?.dateStr ===
                                                    day.dateStr &&
                                                    'ring-2 ring-inset ring-[#556830]'
                                            )}
                                        >
                                            {day.dayNum}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-3 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
                            <span>Class Day</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-400 rounded" />
                            <span>Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded" />
                            <span>Cancelled</span>
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
                                <h3
                                    className={`text-[#203622] mb-2 ${selectedDay.isCancelled ? 'line-through' : ''}`}
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

                            <div className="px-6 py-6 space-y-6">
                                <div>
                                    <h4 className="text-sm text-gray-700 mb-3">
                                        Class Details
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Calendar className="size-5 text-gray-400 mt-0.5 shrink-0" />
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
                                            <Clock className="size-5 text-gray-400 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">
                                                    Time
                                                </div>
                                                <div
                                                    className={`text-[#203622] ${selectedDay.isCancelled ? 'line-through' : ''}`}
                                                >
                                                    {classTime}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="size-5 text-gray-400 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">
                                                    Room
                                                </div>
                                                <div
                                                    className={`text-[#203622] ${selectedDay.isCancelled ? 'line-through' : ''}`}
                                                >
                                                    {schedule.room ||
                                                        'Not assigned'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(selectedDay.isCancelled ||
                                    selectedDay.hasAttendance) && (
                                    <div className="pt-6 border-t border-gray-200">
                                        <h4 className="text-sm text-gray-700 mb-3">
                                            Status
                                        </h4>

                                        {selectedDay.isCancelled && (
                                            <div className="flex items-start gap-2">
                                                <CalendarOff className="size-4 text-gray-600 mt-0.5 shrink-0" />
                                                <div className="text-sm text-gray-900">
                                                    Class Cancelled
                                                </div>
                                            </div>
                                        )}

                                        {selectedDay.hasAttendance && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="size-4 text-[#556830] mt-0.5 shrink-0" />
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
                    }}
                />
            )}

            {rescheduleTarget?.eventId && (
                <RescheduleSessionModal
                    open={!!rescheduleTarget}
                    onClose={() => setRescheduleTarget(null)}
                    classId={cls.id}
                    eventId={rescheduleTarget.eventId}
                    dateLabel={rescheduleTarget.date.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    onRescheduled={() => {
                        setSelectedDay(null);
                        void mutate();
                    }}
                />
            )}
        </div>
    );
}
