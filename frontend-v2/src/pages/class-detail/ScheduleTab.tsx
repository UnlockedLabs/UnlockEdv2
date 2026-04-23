import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Calendar, Clock } from 'lucide-react';
import API from '@/api/api';
import { toast } from 'sonner';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { formatDate, getClassSchedule, ClassScheduleInfo } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { SessionDetailSheet } from './SessionDetailSheet';
import {
    buildRescheduleMaps,
    buildRoomOverrideMap,
    buildCancellationReasonMap,
    buildSessionDisplays,
    findCancelOverrideId,
    type SessionDisplay
} from './session-utils';

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
                    const dtMatch = /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/.exec(rrule);
                    if (dtMatch) {
                        cancelledDates.add(`${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`);
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

export function ScheduleTab({ cls, onClassMutate }: ScheduleTabProps) {
    const schedule = useMemo(() => getClassSchedule(cls), [cls]);
    const [viewDate] = useState(() => new Date());
    const [selectedSession, setSelectedSession] =
        useState<SessionDisplay | null>(null);

    const [yyyy, mm] = [viewDate.getFullYear(), viewDate.getMonth() + 1];
    const { data: instancesResp, mutate } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(
        `/api/program-classes/${cls.id}/events?month=${String(mm).padStart(2, '0')}&year=${yyyy}&per_page=100`
    );

    const instancesByDate = useMemo(() => {
        const map = new Map<string, ClassEventInstance>();
        for (const inst of instancesResp?.data ?? []) {
            map.set(inst.date, inst);
        }
        return map;
    }, [instancesResp]);

    const rescheduleMaps = useMemo(
        () => buildRescheduleMaps(cls.events ?? []),
        [cls.events]
    );

    const roomOverrides = useMemo(
        () => buildRoomOverrideMap(cls.events ?? []),
        [cls.events]
    );

    const cancellationReasons = useMemo(
        () => buildCancellationReasonMap(cls.events ?? []),
        [cls.events]
    );

    const allSessions = useMemo(() => {
        if (!instancesResp?.data) return [];
        return buildSessionDisplays(
            instancesResp.data,
            cls.enrolled,
            rescheduleMaps.fromTo,
            rescheduleMaps.toFrom,
            rescheduleMaps.appliedFutureDates,
            rescheduleMaps.intermediateDates,
            cancellationReasons
        );
    }, [instancesResp, cls.enrolled, rescheduleMaps, cancellationReasons]);

    const sessionsByDate = useMemo(() => {
        const map = new Map<string, SessionDisplay>();
        for (const s of allSessions) {
            if (!map.has(s.instance.date) || !s.instance.is_cancelled) {
                map.set(s.instance.date, s);
            }
        }
        return map;
    }, [allSessions]);

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

    const classTime = schedule.startTime
        ? `${schedule.startTime} - ${schedule.endTime}`
        : 'Not set';

    const refreshData = async () => {
        await mutate();
        onClassMutate();
    };

    const handleUndo = async (session: SessionDisplay) => {
        let overrideId: number | undefined;

        if (session.rescheduleOverrideId) {
            overrideId = session.rescheduleOverrideId;
        } else if (session.isCancelled) {
            overrideId = findCancelOverrideId(
                cls.events ?? [],
                session.instance.date
            );
        }

        if (!overrideId) return;
        const hasAppliedFuture =
            rescheduleMaps.appliedFutureDates.size > 0 &&
            (session.isRescheduledFrom || session.isRescheduledTo);
        const url = hasAppliedFuture
            ? `program-classes/${cls.id}/events/${overrideId}?undo_applied_future=true`
            : `program-classes/${cls.id}/events/${overrideId}`;
        const resp = await API.delete(url);
        if (resp.success) {
            toast.success(
                session.isRescheduledFrom || session.isRescheduledTo
                    ? hasAppliedFuture
                        ? 'Reschedule and future changes undone'
                        : 'Reschedule undone'
                    : 'Cancellation undone'
            );
        }
        await refreshData();
    };

    const handleDayClick = (day: CalendarDay) => {
        const session = sessionsByDate.get(day.dateStr);
        if (session) {
            setSelectedSession(session);
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateObj = new Date(day.date);
        dateObj.setHours(0, 0, 0, 0);
        const instance = instancesByDate.get(day.dateStr) ?? {
            id: day.eventId ?? 0,
            class_id: cls.id,
            duration: '',
            room_id: 0,
            recurrence_rule: '',
            is_cancelled: day.isCancelled,
            overrides: [],
            event_id: day.eventId ?? 0,
            date: day.dateStr,
            class_time: classTime,
            attendance_records: []
        };
        setSelectedSession({
            instance,
            dateObj,
            dayName: dateObj.toLocaleDateString('en-US', {
                weekday: 'long'
            }),
            isToday: day.isToday,
            isPast: dateObj < today,
            isUpcoming: dateObj > today,
            hasAttendance: day.hasAttendance,
            isCancelled: day.isCancelled,
            isRescheduledFrom: false,
            isRescheduledTo: false,
            isCancelledReschedule: false,
            attendedCount: 0,
            totalEnrolled: cls.enrolled
        });
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
                            <div className="grid grid-cols-7 bg-gray-50">
                                {DAY_HEADERS.map((d) => (
                                    <div
                                        key={d}
                                        className="p-2 text-center text-sm font-medium text-gray-600 border-r border-gray-200 last:border-r-0"
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>
                            {calendarWeeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7">
                                    {week.map((day) => {
                                        const showAsClass = day.isClassDay && !day.isCancelled;
                                        const isClickable = day.isClassDay && day.isCurrentMonth;
                                        const calSession = day.isCancelled && day.isCurrentMonth
                                            ? sessionsByDate.get(day.dateStr)
                                            : undefined;
                                        const movedToLabel = calSession?.isRescheduledFrom && calSession.rescheduledDate
                                            ? `Moved to ${new Date(calSession.rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                            : null;

                                        return (
                                            <div
                                                key={day.dateStr}
                                                onClick={() => {
                                                    if (isClickable)
                                                        handleDayClick(day);
                                                }}
                                                className={cn(
                                                    'min-h-[80px] p-2 border-t border-r border-gray-200 last:border-r-0 transition-all',
                                                    !day.isCurrentMonth && 'bg-gray-50',
                                                    day.isToday && 'bg-blue-50',
                                                    showAsClass && day.isCurrentMonth && 'bg-green-50',
                                                    isClickable && 'cursor-pointer hover:ring-2 hover:ring-[#556830] hover:ring-inset',
                                                    selectedSession?.instance.date === day.dateStr && 'ring-2 ring-inset ring-[#556830]'
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
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {movedToLabel ?? 'Cancelled'}
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
                            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded" />
                            <span>Cancelled</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded" />
                            <span>Attendance Recorded</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-100 border border-gray-300 border-dashed rounded" />
                            <span>Rescheduled</span>
                        </div>
                    </div>
                </div>
            </div>

            <SessionDetailSheet
                session={selectedSession}
                onClose={() => setSelectedSession(null)}
                className={cls.name}
                facilityId={String(cls.facility_id)}
                classEvents={cls.events ?? []}
                classTime={
                    selectedSession?.instance.class_time ?? classTime
                }
                room={
                    (selectedSession
                        ? roomOverrides.get(selectedSession.instance.date)
                        : undefined) ??
                    schedule.room ??
                    'Not assigned'
                }
                classId={cls.id}
                onMutate={() => void refreshData()}
                onUndo={() => {
                    if (selectedSession) void handleUndo(selectedSession);
                }}
                allSessions={allSessions}
            />
        </div>
    );
}
