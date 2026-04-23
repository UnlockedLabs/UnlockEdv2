import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import useSWR from 'swr';
import API from '@/api/api';
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
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CancelEventModal } from '@/components/schedule/CancelEventModal';
import { RescheduleEventModal } from '@/components/schedule/RescheduleEventModal';
import { RescheduleSessionModal } from '@/components/schedule/RescheduleSessionModal';
import { RescheduleSeriesModal } from '@/components/schedule/RescheduleSeriesModal';
import { RestoreEventModal } from '@/components/schedule/RestoreEventModal';
import { ChangeRoomModal } from '@/components/schedule/ChangeRoomModal';
import { ChangeInstructorModal } from '@/components/schedule/ChangeInstructorModal';
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    Users,
    CalendarClock,
    CalendarOff,
    CircleCheck
} from 'lucide-react';

const localizer = momentLocalizer(moment);

const SCROLL_TO_TIME = new Date(1970, 0, 1, 7, 0, 0);

interface CalendarEvent {
    id: number;
    title: string;
    start: Date;
    end: Date;
    resource: FacilityProgramClassEvent;
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
    const [showCancel, setShowCancel] = useState(false);
    const [showReschedule, setShowReschedule] = useState(false);
    const [showRescheduleSingle, setShowRescheduleSingle] = useState(false);
    const [showRescheduleSeries, setShowRescheduleSeries] = useState(false);
    const [showRestore, setShowRestore] = useState(false);
    const [showChangeRoom, setShowChangeRoom] = useState(false);
    const [showChangeInstructor, setShowChangeInstructor] = useState(false);
    const [undoingReschedule, setUndoingReschedule] = useState(false);

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

    const isEventToday = (event: FacilityProgramClassEvent | null) => {
        if (!event) return false;
        return new Date().toDateString() === new Date(event.start).toDateString();
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

    async function handleUndoReschedule() {
        if (!selectedEvent) return;
        setUndoingReschedule(true);
        const resp = await API.delete(`program-classes/${selectedEvent.class_id}/events/${selectedEvent.override_id}`);
        setUndoingReschedule(false);
        if (resp.success) {
            toast.success('Reschedule undone');
            handleModalSuccess();
        } else {
            toast.error(resp.message || 'Failed to undo reschedule');
        }
    }



    const subtitle = isDepAdmin ? `Viewing: ${selectedFacilityName}` : 'Manage class schedules';

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

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

                {/* Event Detail Sheet */}
                <Sheet open={showSheet} onOpenChange={setShowSheet}>
                    <SheetContent className="w-[400px] sm:w-[500px] p-0">
                        {selectedEvent && (
                            <>
                                <SheetHeader className="sr-only">
                                    <SheetTitle>Class Instance Details</SheetTitle>
                                    <SheetDescription>
                                        View and manage this class instance
                                    </SheetDescription>
                                </SheetHeader>

                            <div className="border-b border-gray-200 px-6 py-4">
                                <h3
                                    className={`text-[#203622] mb-2 ${
                                        selectedEvent.is_cancelled ? 'line-through' : ''
                                    }`}
                                >
                                    {selectedEvent.start.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {selectedEvent.is_cancelled && (
                                        <Badge
                                            variant="outline"
                                            className="bg-gray-100 text-gray-700 border-gray-300"
                                        >
                                            Cancelled
                                        </Badge>
                                    )}
                                    {selectedEvent.class_status === SelectedClassStatus.Completed && (
                                        <Badge
                                            variant="outline"
                                            className="bg-green-50 text-[#556830] border-green-200"
                                        >
                                            Completed
                                        </Badge>
                                    )}
                                    {!selectedEvent.is_cancelled &&
                                        selectedEvent.class_status === SelectedClassStatus.Scheduled &&
                                        isPastEvent(selectedEvent) && (
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-50 text-amber-700 border-amber-300"
                                            >
                                                Missing Attendance
                                            </Badge>
                                        )}
                                    {!selectedEvent.is_cancelled &&
                                        selectedEvent.class_status === SelectedClassStatus.Scheduled &&
                                        !isPastEvent(selectedEvent) && (
                                            <Badge
                                                variant="outline"
                                                className="bg-gray-50 text-gray-600 border-gray-200"
                                            >
                                                Scheduled
                                            </Badge>
                                        )}
                                    {!selectedEvent.is_cancelled &&
                                        selectedEvent.class_status === SelectedClassStatus.Active && (
                                            <Badge
                                                variant="outline"
                                                className="bg-green-50 text-[#556830] border-green-200"
                                            >
                                                Active
                                            </Badge>
                                        )}
                                    {isEventToday(selectedEvent) && (
                                        <span className="text-sm text-blue-600">• Today's class</span>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-6 space-y-6">
                                <div>
                                    <h4 className="text-sm text-gray-700 mb-3">Class Details</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <CalendarIcon className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">Class</div>
                                                <div className="text-[#203622]">{selectedEvent.title}</div>
                                                <div className="text-sm text-gray-500">
                                                    {selectedEvent.program_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-600 mb-0.5">Time</div>
                                                <div
                                                    className={`text-[#203622] ${
                                                        selectedEvent.is_cancelled ? 'line-through' : ''
                                                    }`}
                                                >
                                                    {selectedEvent.start.toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    })}{' '}
                                                    -{' '}
                                                    {selectedEvent.end.toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedEvent.room && (
                                            <div className="flex items-start gap-3">
                                                <MapPin className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-gray-600 mb-0.5">Room</div>
                                                    <div
                                                        className={`text-[#203622] ${
                                                            selectedEvent.is_cancelled ? 'line-through' : ''
                                                        }`}
                                                    >
                                                        {selectedEvent.room}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedEvent.instructor_name && (
                                            <div className="flex items-start gap-3">
                                                <Users className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-gray-600 mb-0.5">
                                                        Instructor
                                                    </div>
                                                    <div className="text-[#203622]">
                                                        {selectedEvent.instructor_name}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(() => {
                                    const past = isPastEvent(selectedEvent);
                                    const showTakeAttendance =
                                        past &&
                                        !selectedEvent.is_cancelled &&
                                        selectedEvent.class_status !== SelectedClassStatus.Completed;
                                    const showFutureActions = !past && canUpdateEvent();
                                    const showStatus = selectedEvent.is_cancelled;
                                    const isRescheduled = selectedEvent.is_override && !selectedEvent.is_cancelled && !!selectedEvent.linked_override_event && showFutureActions;

                                    if (!showTakeAttendance && !showFutureActions && !showStatus && !isRescheduled) return null;

                                    return (
                                        <>
                                            {isRescheduled && (
                                                <div className="pt-6 border-t border-gray-200">
                                                    <h4 className="text-sm text-gray-700 mb-3">Status</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex items-start gap-2">
                                                            <CalendarClock className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                                            <div className="text-sm text-gray-900">Rescheduled Class</div>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                            onClick={() => void handleUndoReschedule()}
                                                            disabled={undoingReschedule}
                                                        >
                                                            {undoingReschedule ? 'Undoing...' : 'Undo Reschedule'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {showStatus && (
                                                <div className="pt-6 border-t border-gray-200">
                                                    <h4 className="text-sm text-gray-700 mb-3">Status</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex items-start gap-2">
                                                            <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-gray-900 mb-1">Class Cancelled</div>
                                                                {selectedEvent.reason && (
                                                                    <p className="text-sm text-gray-600">{selectedEvent.reason}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {showFutureActions && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full"
                                                                onClick={() => {
                                                                    setShowSheet(false);
                                                                    setShowRestore(true);
                                                                }}
                                                            >
                                                                {selectedEvent.is_override ? 'Undo Cancellation' : 'Restore Future Sessions'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {(showTakeAttendance || (showFutureActions && !selectedEvent.is_cancelled && !isRescheduled)) && (
                                                <div className="pt-6 border-t border-gray-200">
                                                    <h4 className="text-sm text-gray-700 mb-3">Actions</h4>
                                                    <div className="space-y-2">
                                                        {showTakeAttendance && (
                                                            <Button
                                                                className="w-full justify-start bg-[#556830] hover:bg-[#203622] text-white"
                                                                onClick={() => {
                                                                    const d = selectedEvent.start;
                                                                    const date = [
                                                                        d.getFullYear(),
                                                                        String(d.getMonth() + 1).padStart(2, '0'),
                                                                        String(d.getDate()).padStart(2, '0')
                                                                    ].join('-');
                                                                    setShowSheet(false);
                                                                    navigate(
                                                                        `/program-classes/${selectedEvent.class_id}/events/${selectedEvent.id}/attendance/${date}`
                                                                    );
                                                                }}
                                                            >
                                                                <CircleCheck className="size-4 mr-2" />
                                                                Take Attendance
                                                            </Button>
                                                        )}
                                                        {showFutureActions && !selectedEvent.is_cancelled && !isRescheduled && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                                                    onClick={() => {
                                                                        setShowSheet(false);
                                                                        setShowReschedule(true);
                                                                    }}
                                                                >
                                                                    <CalendarClock className="size-4 mr-2" />
                                                                    Reschedule This Class
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-start border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                                                    onClick={() => {
                                                                        setShowSheet(false);
                                                                        setShowCancel(true);
                                                                    }}
                                                                >
                                                                    <CalendarOff className="size-4 mr-2" />
                                                                    Cancel This Class
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                                                    onClick={() => {
                                                                        setShowSheet(false);
                                                                        setShowChangeInstructor(true);
                                                                    }}
                                                                >
                                                                    <Users className="size-4 mr-2" />
                                                                    Change Instructor
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                                                    onClick={() => {
                                                                        setShowSheet(false);
                                                                        setShowChangeRoom(true);
                                                                    }}
                                                                >
                                                                    <MapPin className="size-4 mr-2" />
                                                                    Change Room
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {!selectedEvent.is_cancelled && (
                                    <div className="pt-2">
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => {
                                                setShowSheet(false);
                                                navigate(`/program-classes/${selectedEvent.class_id}/detail`);
                                            }}
                                        >
                                            View Full Class Details →
                                        </Button>
                                    </div>
                                )}

                            </div>
                            </>
                        )}
                    </SheetContent>
                </Sheet>

            {selectedEvent && (
                <>
                    <CancelEventModal
                        open={showCancel}
                        onOpenChange={setShowCancel}
                        event={selectedEvent}
                        onSuccess={handleModalSuccess}
                    />
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
                    <ChangeRoomModal
                        open={showChangeRoom}
                        onOpenChange={setShowChangeRoom}
                        event={selectedEvent}
                        rooms={rooms}
                        onSuccess={handleModalSuccess}
                    />
                    <ChangeInstructorModal
                        open={showChangeInstructor}
                        onOpenChange={setShowChangeInstructor}
                        event={selectedEvent}
                        facilityId={activeFacilityId}
                        onSuccess={handleModalSuccess}
                    />
                </>
            )}
        </div>
        </div>
    );
}
