import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { toZonedTime } from 'date-fns-tz';
import { Calendar as BigCalendar, momentLocalizer, View } from 'react-big-calendar';
// react-big-calendar types are incompatible with @types/react@18 (missing `refs`)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Calendar = BigCalendar as unknown as React.ComponentType<any>;
import moment from 'moment';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    FacilityProgramClassEvent,
    ServerResponseMany,
    SelectedClassStatus,
    Room,
    Facility
} from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RescheduleEventModal } from '@/components/schedule/RescheduleEventModal';
import { RescheduleSessionModal } from '@/components/schedule/RescheduleSessionModal';
import { RescheduleSeriesModal } from '@/components/schedule/RescheduleSeriesModal';
import { RestoreEventModal } from '@/components/schedule/RestoreEventModal';
import { SessionDetailSheet } from '@/components/schedule/SessionDetailSheet';
import type { SessionDisplay } from '@/pages/class-detail/session-utils';

const localizer = momentLocalizer(moment);

const SCROLL_TO_TIME = new Date(1970, 0, 1, 7, 0, 0);

interface CalendarEvent {
    id: number;
    title: string;
    start: Date;
    end: Date;
    resource: FacilityProgramClassEvent;
}

function toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toClassTimeRange(start: Date, end: Date): string {
    const fmt = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${fmt(start)}-${fmt(end)}`;
}

function facilityEventToSessionDisplay(
    event: FacilityProgramClassEvent
): SessionDisplay {
    const start = event.start;
    const end = event.end;
    const now = new Date();
    const isToday = now.toDateString() === start.toDateString();
    const isPast = now > end;
    const isUpcoming = !isPast;
    const hasAttendance = event.class_status === SelectedClassStatus.Completed;
    const isCancelled = event.is_cancelled;
    const linked = event.linked_override_event as
        | FacilityProgramClassEvent
        | null
        | undefined;
    const isRescheduledTo = !isCancelled && event.is_override && !!linked;

    let rescheduledDate: string | undefined;
    if (linked?.start) {
        const linkedStart =
            linked.start instanceof Date ? linked.start : new Date(linked.start);
        if (!Number.isNaN(linkedStart.getTime())) {
            rescheduledDate = toDateString(linkedStart);
        }
    }

    return {
        instance: {
            id: event.id,
            class_id: event.class_id,
            duration: event.duration,
            room_id: event.room_id,
            recurrence_rule: event.recurrence_rule,
            is_cancelled: event.is_cancelled,
            instructor_id: event.instructor_id ?? null,
            overrides: event.overrides ?? [],
            reason: event.reason ?? null,
            event_id: event.id,
            date: toDateString(start),
            class_time: toClassTimeRange(start, end),
            attendance_records: [],
            override_id: event.override_id || undefined
        },
        dateObj: start,
        dayName: start.toLocaleDateString('en-US', { weekday: 'long' }),
        isToday,
        isPast,
        isUpcoming,
        hasAttendance,
        isCancelled,
        isRescheduledFrom: false,
        isRescheduledTo,
        isCancelledReschedule: false,
        rescheduledDate,
        rescheduleOverrideId: event.override_id || undefined,
        cancellationReason: event.reason ?? undefined,
        attendedCount: 0,
        totalEnrolled: 0
    };
}

export default function Schedule() {
    const { user } = useAuth();
    const { class_id } = useParams<{ class_id?: string }>();
    const navigate = useNavigate();

    // All state must be before any early return
    const [currentView, setCurrentView] = useState<View>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
    const [selectedProgram, setSelectedProgram] = useState<string>('all');
    const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
    const [showAllClasses, setShowAllClasses] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<FacilityProgramClassEvent | null>(null);
    const [showSheet, setShowSheet] = useState(false);
    const [showReschedule, setShowReschedule] = useState(false);
    const [showRescheduleSingle, setShowRescheduleSingle] = useState(false);
    const [showRescheduleSeries, setShowRescheduleSeries] = useState(false);
    const [showRestore, setShowRestore] = useState(false);

    const isDepAdmin = user ? isDeptAdmin(user) : false;
    const activeFacilityId = selectedFacilityId || (user ? String(user.facility.id) : '');
    const timezone = user?.timezone ?? 'UTC';

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        isDepAdmin ? '/api/facilities' : null
    );
    const facilities = useMemo(() => facilitiesResp?.data ?? [], [facilitiesResp]);

    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);

    const apiUrl = useMemo(() => {
        if (!user) return null;
        let url = `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}`;
        if (class_id && !showAllClasses) url += `&class_id=${class_id}`;
        if (isDepAdmin && activeFacilityId) url += `&facility_id=${activeFacilityId}`;
        return url;
    }, [user, startDate, endDate, class_id, showAllClasses, isDepAdmin, activeFacilityId]);

    const { data: eventsResp, isLoading, mutate } = useSWR<ServerResponseMany<FacilityProgramClassEvent>>(apiUrl);
    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        activeFacilityId ? `/api/rooms?facility_id=${activeFacilityId}` : '/api/rooms'
    );

    const rooms = useMemo(() => roomsResp?.data ?? [], [roomsResp]);
    const rawEvents = useMemo(() => eventsResp?.data ?? [], [eventsResp]);

    const formattedEvents = useMemo(() => {
        return rawEvents.map((event) => ({
            ...event,
            start: toZonedTime(new Date(event.start), timezone),
            end: toZonedTime(new Date(event.end), timezone)
        }));
    }, [rawEvents, timezone]);

    const availablePrograms = useMemo(() => {
        const map = new Map<number, string>();
        formattedEvents.forEach((e) => {
            if (e.program_id && e.program_name) map.set(e.program_id, e.program_name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [formattedEvents]);

    const availableInstructors = useMemo(() => {
        const set = new Set<string>();
        formattedEvents.forEach((e) => {
            if (e.instructor_name) set.add(e.instructor_name);
        });
        return Array.from(set).sort();
    }, [formattedEvents]);

    const filteredEvents = useMemo(() => {
        return formattedEvents.filter((e) => {
            if (selectedProgram !== 'all' && String(e.program_id) !== selectedProgram) return false;
            if (selectedInstructor !== 'all' && e.instructor_name !== selectedInstructor) return false;
            return true;
        });
    }, [formattedEvents, selectedProgram, selectedInstructor]);

    const calendarEvents: CalendarEvent[] = useMemo(() => {
        return filteredEvents.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            resource: e
        }));
    }, [filteredEvents]);

    const selectedFacilityName = useMemo(() => {
        if (!user) return '';
        if (!isDepAdmin) return user.facility.name;
        return facilities.find((f) => String(f.id) === activeFacilityId)?.name ?? user.facility.name;
    }, [isDepAdmin, facilities, activeFacilityId, user]);

    const sessionView = useMemo(
        () =>
            showSheet && selectedEvent
                ? facilityEventToSessionDisplay(selectedEvent)
                : null,
        [showSheet, selectedEvent]
    );

    // Early return after all hooks
    if (!user) return null;

    const canUpdateEvent = (): boolean => {
        if (!selectedEvent) return false;
        if (
            selectedEvent.class_status === SelectedClassStatus.Completed ||
            selectedEvent.class_status === SelectedClassStatus.Cancelled
        )
            return false;
        if (class_id && selectedEvent.class_id.toString() !== class_id) return false;
        return true;
    };

    const isPastEvent = (event: FacilityProgramClassEvent | null) => {
        if (!event) return false;
        return new Date() > new Date(event.end);
    };

    const eventStyleGetter = (event: CalendarEvent) => {
        const e = event.resource;
        let backgroundColor = '#556830';
        let borderColor = '#203622';
        if (e.is_cancelled) {
            backgroundColor = '#9ca3af';
            borderColor = '#6b7280';
        }
        return {
            style: {
                backgroundColor,
                borderColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '4px',
                opacity: e.is_cancelled ? 0.6 : 1,
                color: 'white',
                textDecoration: e.is_cancelled ? 'line-through' : 'none'
            }
        };
    };

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event.resource);
        setShowSheet(true);
    };

    const handleModalSuccess = () => {
        void mutate();
        setSelectedEvent(null);
        setShowSheet(false);
    };

    const handleTakeAttendance = () => {
        if (!selectedEvent) return;
        const d = selectedEvent.start;
        const date = toDateString(d);
        setShowSheet(false);
        navigate(
            `/program-classes/${selectedEvent.class_id}/events/${selectedEvent.id}/attendance/${date}`
        );
    };

    const handleViewClassDetails = () => {
        if (!selectedEvent) return;
        setShowSheet(false);
        navigate(`/program-classes/${selectedEvent.class_id}/detail`);
    };

    const handleRescheduleClick = () => {
        setShowReschedule(true);
    };

    const handleCancellationAction = () => {
        // For calendar: opens RestoreEventModal (which handles both single-override undo and series-restore).
        setShowRestore(true);
    };

    const subtitle = isDepAdmin ? `Viewing: ${selectedFacilityName}` : 'Manage class schedules';

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    const past = isPastEvent(selectedEvent);
    const cancellationActionLabel = selectedEvent?.is_override
        ? 'Undo Cancellation'
        : 'Restore Future Sessions';
    const disableModifyActions = past || !canUpdateEvent();
    const showActiveBadge =
        !!selectedEvent &&
        !selectedEvent.is_cancelled &&
        selectedEvent.class_status === SelectedClassStatus.Active;

    return (
        <div className="bg-[#E7EAED] dark:bg-[#0a0a0a] min-h-screen overflow-x-hidden">
            <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl text-[#203622] mb-2">
                            {class_id ? 'Class Schedule' : 'Schedule'}
                        </h1>
                        <p className="text-gray-600">{subtitle}</p>
                    </div>
                    {class_id && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAllClasses}
                                onChange={(e) => setShowAllClasses(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Show all classes
                        </label>
                    )}
                </div>

                {/* Filters — hidden in class-specific view */}
                {!class_id && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {isDepAdmin && (
                                <div>
                                    <label className="text-sm font-medium text-[#203622] mb-2 block">
                                        Facility
                                    </label>
                                    <Select
                                        value={activeFacilityId}
                                        onValueChange={(val) => {
                                            setSelectedFacilityId(val);
                                            setSelectedProgram('all');
                                            setSelectedInstructor('all');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities.map((f) => (
                                                <SelectItem key={f.id} value={String(f.id)}>
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium text-[#203622] mb-2 block">
                                    Program
                                </label>
                                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Programs" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Programs</SelectItem>
                                        {availablePrograms.map((p) => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-[#203622] mb-2 block">
                                    Instructor
                                </label>
                                <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Instructors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Instructors</SelectItem>
                                        {availableInstructors.map((i) => (
                                            <SelectItem key={i} value={i}>
                                                {i}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Calendar */}
                <div
                    className="bg-white border border-gray-200 rounded-lg p-6 unlocked-calendar"
                    style={{ height: '700px' }}
                >
                    <Calendar
                        localizer={localizer}
                        events={calendarEvents}
                        startAccessor="start"
                        endAccessor="end"
                        view={currentView}
                        onView={setCurrentView}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        views={['month', 'week', 'day', 'agenda']}
                        style={{ height: '100%' }}
                        min={new Date(0, 0, 0, 0, 0, 0, 0)}
                        max={new Date(0, 0, 0, 23, 59, 59, 999)}
                        scrollToTime={SCROLL_TO_TIME}
                    />
                </div>

                {selectedEvent && (
                    <SessionDetailSheet
                        session={sessionView}
                        onClose={() => setShowSheet(false)}
                        className={selectedEvent.title}
                        classTime={toClassTimeRange(selectedEvent.start, selectedEvent.end)}
                        room={selectedEvent.room}
                        originalRoom={selectedEvent.original_room}
                        instructorName={selectedEvent.instructor_name}
                        originalInstructorName={selectedEvent.original_instructor_name}
                        classId={selectedEvent.class_id}
                        facilityId={activeFacilityId}
                        classEvents={[]}
                        facilityEvent={selectedEvent}
                        onMutate={() => void mutate()}
                        onUndo={handleCancellationAction}
                        programName={selectedEvent.program_name}
                        showActiveBadge={showActiveBadge}
                        hideRescheduledBadge
                        cancellationActionLabel={cancellationActionLabel}
                        disableModifyActions={disableModifyActions}
                        onReschedule={handleRescheduleClick}
                        onTakeAttendance={
                            past &&
                            !selectedEvent.is_cancelled &&
                            selectedEvent.class_status !== SelectedClassStatus.Completed
                                ? handleTakeAttendance
                                : undefined
                        }
                        onViewClassDetails={handleViewClassDetails}
                    />
                )}

                {selectedEvent && (
                    <>
                        <RescheduleEventModal
                            open={showReschedule}
                            onOpenChange={setShowReschedule}
                            event={selectedEvent}
                            onSingleSession={() => {
                                setShowReschedule(false);
                                setShowRescheduleSingle(true);
                            }}
                            onSeriesReschedule={() => {
                                setShowReschedule(false);
                                setShowRescheduleSeries(true);
                            }}
                        />
                        <RescheduleSessionModal
                            open={showRescheduleSingle}
                            onOpenChange={setShowRescheduleSingle}
                            event={selectedEvent}
                            rooms={rooms}
                            onSuccess={handleModalSuccess}
                        />
                        <RescheduleSeriesModal
                            open={showRescheduleSeries}
                            onOpenChange={setShowRescheduleSeries}
                            event={selectedEvent}
                            rooms={rooms}
                            onSuccess={handleModalSuccess}
                        />
                        <RestoreEventModal
                            open={showRestore}
                            onOpenChange={setShowRestore}
                            event={selectedEvent}
                            onSuccess={handleModalSuccess}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
