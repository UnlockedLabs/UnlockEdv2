import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { toZonedTime } from 'date-fns-tz';
import { useAuth } from '@/auth/useAuth';
import {
    FacilityProgramClassEvent,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Calendar, Clock, MapPin, User, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function getWeekDates(referenceDate: Date): Date[] {
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

export default function Schedule() {
    const { user } = useAuth();
    const { class_id } = useParams<{ class_id?: string }>();
    const [selectedEvent, setSelectedEvent] = useState<FacilityProgramClassEvent | null>(null);
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [showAllClasses, setShowAllClasses] = useState(false);

    if (!user) return null;

    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);

    const { data: eventsResp, isLoading } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>
    >(
        `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}${
            class_id && !showAllClasses ? `&class_id=${class_id}` : ''
        }`
    );

    const events = eventsResp?.data ?? [];

    const formattedEvents = useMemo(() => {
        return events.map((event) => ({
            ...event,
            start: toZonedTime(new Date(event.start), user.timezone),
            end: toZonedTime(new Date(event.end), user.timezone)
        }));
    }, [events, user.timezone]);

    const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

    const weekEvents = useMemo(() => {
        return formattedEvents.filter((event) =>
            weekDates.some((day) => isSameDay(event.start, day))
        );
    }, [formattedEvents, weekDates]);

    const goToPreviousWeek = () => {
        const prev = new Date(currentWeek);
        prev.setDate(prev.getDate() - 7);
        setCurrentWeek(prev);
    };

    const goToNextWeek = () => {
        const next = new Date(currentWeek);
        next.setDate(next.getDate() + 7);
        setCurrentWeek(next);
    };

    const goToToday = () => {
        setCurrentWeek(new Date());
    };

    const canUpdateEvent = (): boolean => {
        if (!selectedEvent) return false;
        if (
            selectedEvent.class_status === SelectedClassStatus.Completed ||
            selectedEvent.class_status === SelectedClassStatus.Cancelled
        ) {
            return false;
        }
        if (class_id && selectedEvent.class_id.toString() !== class_id) {
            return false;
        }
        return true;
    };

    const weekLabel = useMemo(() => {
        const start = weekDates[0];
        const end = weekDates[6];
        const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
        if (startMonth === endMonth) {
            return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
    }, [weekDates]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={class_id ? 'Class Schedule' : 'Facility Schedule'}
                subtitle="View and manage scheduled classes"
                actions={
                    class_id ? (
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={showAllClasses}
                                onChange={(e) => setShowAllClasses(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Show all classes
                        </label>
                    ) : undefined
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <Card className="bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={goToToday}>
                                        Today
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={goToNextWeek}>
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                                <h3 className="text-lg font-semibold text-[#203622]">{weekLabel}</h3>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <div className="min-w-[700px]">
                                    <div className="grid grid-cols-8 border-b border-gray-200">
                                        <div className="p-2 text-xs text-muted-foreground" />
                                        {weekDates.map((date, i) => {
                                            const isToday = isSameDay(date, new Date());
                                            return (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        'p-2 text-center border-l border-gray-100',
                                                        isToday && 'bg-[#E2E7EA]'
                                                    )}
                                                >
                                                    <div className="text-xs text-muted-foreground">{SHORT_DAYS[i]}</div>
                                                    <div className={cn(
                                                        'text-sm font-medium',
                                                        isToday ? 'text-[#203622]' : 'text-gray-700'
                                                    )}>
                                                        {date.getDate()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {HOURS.map((hour) => (
                                        <div key={hour} className="grid grid-cols-8 border-b border-gray-50 min-h-[60px]">
                                            <div className="p-1 text-xs text-muted-foreground text-right pr-2 pt-1">
                                                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                                            </div>
                                            {weekDates.map((date, dayIdx) => {
                                                const dayEvents = weekEvents.filter(
                                                    (e) => isSameDay(e.start, date) && e.start.getHours() === hour
                                                );
                                                return (
                                                    <div key={dayIdx} className="border-l border-gray-50 p-0.5 relative">
                                                        {dayEvents.map((event) => (
                                                            <button
                                                                key={event.id}
                                                                onClick={() => setSelectedEvent(event)}
                                                                className={cn(
                                                                    'w-full text-left text-xs p-1 rounded mb-0.5 truncate',
                                                                    selectedEvent?.id === event.id
                                                                        ? 'bg-[#203622] text-white'
                                                                        : event.is_cancelled
                                                                          ? 'bg-red-50 text-red-700 border border-red-200'
                                                                          : 'bg-[#556830]/10 text-[#203622] border border-[#556830]/20 hover:bg-[#556830]/20'
                                                                )}
                                                            >
                                                                {event.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card className="bg-white sticky top-6">
                        <CardHeader>
                            <CardTitle className="text-[#203622] text-lg">Event Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedEvent ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-[#203622] text-base">
                                            {selectedEvent.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {selectedEvent.program_name}
                                        </p>
                                    </div>

                                    <StatusBadge status={selectedEvent.class_status} variant="class" />

                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Clock className="size-4 text-muted-foreground" />
                                            <span>
                                                {formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="size-4 text-muted-foreground" />
                                            <span>
                                                {selectedEvent.start.toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        {selectedEvent.room && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="size-4 text-muted-foreground" />
                                                <span>{selectedEvent.room}</span>
                                            </div>
                                        )}
                                        {selectedEvent.instructor_name && (
                                            <div className="flex items-center gap-2">
                                                <User className="size-4 text-muted-foreground" />
                                                <span>{selectedEvent.instructor_name}</span>
                                            </div>
                                        )}
                                        {selectedEvent.enrolled_users && (
                                            <div className="flex items-center gap-2">
                                                <Users className="size-4 text-muted-foreground" />
                                                <span>{selectedEvent.enrolled_users} enrolled</span>
                                            </div>
                                        )}
                                        {selectedEvent.credit_types && (
                                            <div className="text-xs text-muted-foreground pt-2 border-t">
                                                Credits: {selectedEvent.credit_types}
                                            </div>
                                        )}
                                    </div>

                                    {selectedEvent.is_cancelled && (
                                        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                                            This session has been cancelled.
                                        </div>
                                    )}

                                    {class_id && selectedEvent.class_id.toString() !== class_id && (
                                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                                            This event belongs to another class and cannot be edited here.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Select an event from the calendar to view details.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
