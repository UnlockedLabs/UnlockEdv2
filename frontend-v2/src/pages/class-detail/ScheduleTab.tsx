import { useMemo, useState } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Class } from '@/types/program';
import { getClassSchedule, ClassScheduleInfo } from '@/lib/formatters';
import { cn } from '@/lib/utils';

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
}

function generateCalendarGrid(
    year: number,
    month: number,
    schedule: ClassScheduleInfo,
    cls: Class
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

            weekDays.push({
                date: new Date(current),
                dateStr,
                dayNum: current.getDate(),
                isCurrentMonth: current.getMonth() === month,
                isToday: dateStr === todayStr,
                isClassDay: isClassDay && isInRange,
                isCancelled: cancelledDates.has(dateStr)
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

    const calendarWeeks = useMemo(
        () =>
            generateCalendarGrid(
                viewDate.getFullYear(),
                viewDate.getMonth(),
                schedule,
                cls
            ),
        [viewDate, schedule, cls]
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

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-foreground mb-1 font-semibold">
                        Recurring Schedule Pattern
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Reference for the regular class schedule. To manage
                        specific sessions, use the Sessions tab.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
                        <Calendar className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-foreground mb-1 font-medium">
                                Regular Sessions
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {schedule.days.join(', ')} at{' '}
                                {schedule.startTime} - {schedule.endTime}
                            </div>
                            {schedule.room && (
                                <div className="text-sm text-muted-foreground mt-1">
                                    {schedule.room}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
                        <Clock className="size-5 text-[#556830] mt-0.5" />
                        <div>
                            <div className="text-foreground mb-1 font-medium">
                                Duration
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {cls.start_dt} to {cls.end_dt || 'Ongoing'}
                            </div>
                            {cls.credit_hours > 0 && (
                                <div className="text-sm text-muted-foreground mt-1">
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
                            <h4 className="text-foreground font-medium min-w-[180px] text-center">
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
                        <p className="text-sm text-muted-foreground">
                            Click any class day to view details
                        </p>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-7 bg-muted">
                            {DAY_HEADERS.map((d) => (
                                <div
                                    key={d}
                                    className="py-2 text-center text-xs font-medium text-muted-foreground"
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
                                            'h-12 text-sm border-t border-r border-border last:border-r-0 flex items-center justify-center relative transition-colors',
                                            !day.isCurrentMonth &&
                                                'text-muted-foreground',
                                            day.isCurrentMonth &&
                                                !day.isClassDay &&
                                                'text-muted-foreground',
                                            day.isClassDay &&
                                                !day.isCancelled &&
                                                'bg-green-50 text-[#556830] font-medium hover:bg-green-100 cursor-pointer',
                                            day.isClassDay &&
                                                day.isCancelled &&
                                                'bg-muted text-muted-foreground line-through cursor-pointer hover:bg-gray-300',
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

                    {selectedDay && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="size-4 text-[#556830]" />
                                <span className="font-medium text-foreground">
                                    {selectedDay.date.toLocaleDateString(
                                        'en-US',
                                        {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        }
                                    )}
                                </span>
                                {selectedDay.isCancelled && (
                                    <Badge
                                        variant="outline"
                                        className="bg-muted text-muted-foreground border-gray-300"
                                    >
                                        Cancelled
                                    </Badge>
                                )}
                            </div>
                            {!selectedDay.isCancelled && (
                                <div className="text-sm text-muted-foreground">
                                    {schedule.startTime} - {schedule.endTime}
                                    {schedule.room && ` | ${schedule.room}`}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
                            <span>Class Day</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-400 rounded" />
                            <span>Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-muted border border-gray-300 rounded" />
                            <span>Cancelled</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
