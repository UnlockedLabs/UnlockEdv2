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
import { CancelEventModal } from '@/components/schedule/CancelEventModal';
import { ChangeInstructorModal } from '@/components/schedule/ChangeInstructorModal';
import { ChangeRoomModal } from '@/components/schedule/ChangeRoomModal';
import { RescheduleSessionModal } from '@/pages/class-detail/RescheduleSessionModal';
import {
    findActiveOverride,
    type SessionDisplay
} from '@/pages/class-detail/session-utils';
import {
    FacilityProgramClassEvent,
    ProgramClassEvent,
    Room,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import { formatClassTimeRange } from '@/lib/formatters';

interface SessionDetailSheetProps {
    session: SessionDisplay | null;
    onClose: () => void;
    className: string;
    classTime: string;
    room: string;
    originalRoom?: string;
    instructorName?: string;
    originalInstructorName?: string;
    classId: number;
    facilityId: string;
    classEvents: ProgramClassEvent[];
    onMutate: () => void;
    onUndo: () => void;
    onUndoCancel?: () => void;
    onUndoReschedule?: () => void;
    allSessions?: SessionDisplay[];

    // Optional variant hooks for calendar/admin-schedule usage.
    /** Program name shown under the class title in Class Details. */
    programName?: string;
    /** Render the "Active" status badge (class_status === Active). */
    showActiveBadge?: boolean;
    /** Suppress the Rescheduled / Rescheduled-Class badges in the header. */
    hideRescheduledBadge?: boolean;
    /** Override the cancellation-undo button label (default: "Undo Cancellation"). */
    cancellationActionLabel?: string;
    /** When set, "Reschedule This Class" fires this callback instead of opening the built-in modal. */
    onReschedule?: () => void;
    /** Render a "Take Attendance" action (past + scheduled + not completed/cancelled). */
    onTakeAttendance?: () => void;
    /** Render a "View Full Class Details →" link at the bottom. */
    onViewClassDetails?: () => void;
    /** Pre-built FacilityProgramClassEvent for the cancel/change-room/change-instructor modals. If omitted, one is synthesized from session + classEvents. */
    facilityEvent?: FacilityProgramClassEvent;
    /** Force-disable the modify actions block (Reschedule/Cancel/Change Instructor/Change Room) regardless of session flags. */
    disableModifyActions?: boolean;
}

function buildFacilityEvent(
    session: SessionDisplay,
    classId: number,
    classEvents: ProgramClassEvent[]
): FacilityProgramClassEvent {
    const eventId = session.instance.event_id ?? session.instance.id;
    const backingEvent = classEvents.find((e) => e.id === eventId) ?? classEvents[0];
    const activeOverride = findActiveOverride(classEvents, session.instance.date);

    const parts = session.instance.class_time.split('-');
    const [sh = 0, sm = 0] = (parts[0] ?? '').split(':').map(Number);
    const [eh = 0, em = 0] = (parts[1] ?? '').split(':').map(Number);

    const start = new Date(session.dateObj);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(session.dateObj);
    end.setHours(eh, em, 0, 0);

    return {
        id: eventId,
        class_id: classId,
        duration: backingEvent?.duration ?? '',
        room_id: activeOverride?.room_id ?? backingEvent?.room_id ?? 0,
        recurrence_rule: backingEvent?.recurrence_rule ?? '',
        is_cancelled: session.instance.is_cancelled,
        instructor_id: activeOverride?.instructor_id ?? backingEvent?.instructor_id ?? null,
        overrides: backingEvent?.overrides ?? [],
        reason: null,
        start,
        end,
        is_override: !!activeOverride || !!session.instance.override_id,
        override_id: activeOverride?.id ?? session.instance.override_id ?? 0,
        linked_override_event: null as unknown as FacilityProgramClassEvent,
        room: '',
        instructor_name: '',
        program_id: 0,
        program_name: '',
        title: '',
        enrolled_users: '',
        frequency: '',
        credit_types: '',
        class_status: SelectedClassStatus.Scheduled
    };
}

export function SessionDetailSheet({
    session,
    onClose,
    className,
    classTime,
    room,
    originalRoom,
    instructorName,
    originalInstructorName,
    classId,
    facilityId,
    classEvents,
    onMutate,
    onUndo,
    onUndoCancel,
    onUndoReschedule,
    allSessions = [],
    programName,
    showActiveBadge = false,
    hideRescheduledBadge = false,
    cancellationActionLabel = 'Undo Cancellation',
    onReschedule,
    onTakeAttendance,
    onViewClassDetails,
    facilityEvent: facilityEventOverride,
    disableModifyActions = false
}: SessionDetailSheetProps) {
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showChangeInstructor, setShowChangeInstructor] = useState(false);
    const [showChangeRoom, setShowChangeRoom] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        facilityId ? `/api/rooms?facility_id=${facilityId}` : '/api/rooms'
    );
    const rooms = roomsResp?.data ?? [];

    const futureSessions = useMemo(() => {
        if (!session) return [];
        return allSessions
            .filter(
                (s) =>
                    s.isUpcoming &&
                    !s.isCancelled &&
                    !s.isRescheduledFrom &&
                    s.instance.date > session.instance.date
            )
            .map((s) => ({
                date: s.instance.date,
                dateLabel: s.dateObj.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                }),
                eventId: s.instance.event_id ?? s.instance.id,
                classTime: s.instance.class_time,
                dateObj: s.dateObj,
                dayName: s.dateObj.toLocaleDateString('en-US', {
                    weekday: 'long'
                })
            }));
    }, [allSessions, session]);

    if (!session) return null;

    const {
        instance,
        dateObj,
        isCancelled,
        isRescheduledFrom,
        isRescheduledTo,
        isCancelledReschedule,
        rescheduledDate,
        cancellationReason,
        hasAttendance,
        isToday
    } = session;

    const canModify =
        !disableModifyActions &&
        !hasAttendance &&
        !isCancelled &&
        !isRescheduledFrom &&
        !isRescheduledTo &&
        !isCancelledReschedule;

    const eventId = instance.event_id ?? instance.id;

    const dateLabel = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const shortDateLabel = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const facilityEvent =
        facilityEventOverride ?? buildFacilityEvent(session, classId, classEvents);

    const getStatusBadge = () => {
        if (isCancelled || isCancelledReschedule) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-700 border-gray-300"
                >
                    Cancelled
                </Badge>
            );
        }
        if (isRescheduledFrom && !hideRescheduledBadge) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-600 border-gray-300"
                >
                    Rescheduled
                </Badge>
            );
        }
        if (isRescheduledTo && !hideRescheduledBadge) {
            return (
                <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-300"
                >
                    Rescheduled Class
                </Badge>
            );
        }
        if (hasAttendance) {
            return (
                <Badge
                    variant="outline"
                    className="bg-green-50 text-[#556830] border-green-200"
                >
                    Completed
                </Badge>
            );
        }
        if (showActiveBadge) {
            return (
                <Badge
                    variant="outline"
                    className="bg-green-50 text-[#556830] border-green-200"
                >
                    Active
                </Badge>
            );
        }
        if (session.isUpcoming) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-50 text-gray-600 border-gray-200"
                >
                    Scheduled
                </Badge>
            );
        }
        return (
            <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200"
            >
                Missing Attendance
            </Badge>
        );
    };

    const handleUndo = () => {
        onUndo();
        onClose();
    };

    const showTakeAttendance =
        !!onTakeAttendance &&
        session.isPast &&
        !isCancelled &&
        !hasAttendance;

    return (
        <>
            <Sheet open={!!session} onOpenChange={onClose}>
                <SheetContent className="w-[400px] sm:w-[500px] p-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Class Instance Details</SheetTitle>
                        <SheetDescription>
                            View and manage this class instance
                        </SheetDescription>
                    </SheetHeader>

                    <div className="border-b border-gray-200 px-6 py-4">
                        <div>
                            <h3
                                className={`text-[#203622] mb-2 ${isCancelled || isRescheduledFrom || isCancelledReschedule ? 'line-through' : ''}`}
                            >
                                {dateLabel}
                            </h3>
                            <div className="flex items-center gap-2">
                                {getStatusBadge()}
                                {isToday && (
                                    <span className="text-sm text-blue-600">
                                        &bull; Today&apos;s class
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto min-h-0">
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
                                            {className}
                                        </div>
                                        {programName && (
                                            <div className="text-sm text-gray-500">
                                                {programName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Clock className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-gray-600 mb-0.5">
                                            Time
                                        </div>
                                        <div
                                            className={`text-[#203622] ${isCancelled || isRescheduledFrom || isCancelledReschedule ? 'line-through' : ''}`}
                                        >
                                            {formatClassTimeRange(classTime)}
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
                                            className={`text-[#203622] ${
                                                !!originalRoom || isCancelled || isRescheduledFrom || isCancelledReschedule
                                                    ? 'line-through'
                                                    : ''
                                            }`}
                                        >
                                            {originalRoom ?? room}
                                        </div>
                                    </div>
                                </div>
                                {(originalInstructorName ?? instructorName) && (
                                    <div className="flex items-start gap-3">
                                        <Users className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-600 mb-0.5">
                                                Instructor
                                            </div>
                                            <div
                                                className={`text-[#203622] ${
                                                    !!originalInstructorName || isCancelled || isRescheduledFrom || isCancelledReschedule
                                                        ? 'line-through'
                                                        : ''
                                                }`}
                                            >
                                                {originalInstructorName ?? instructorName}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(isCancelled ||
                            isCancelledReschedule ||
                            isRescheduledFrom ||
                            isRescheduledTo ||
                            hasAttendance ||
                            (!isCancelled && (originalInstructorName ?? originalRoom))) && (
                            <div className="pt-6 border-t border-gray-200">
                                <h4 className="text-sm text-gray-700 mb-3">
                                    Status
                                </h4>
                                <div className="space-y-4">

                                {!isCancelled && originalInstructorName && instructorName && (
                                    <div className="flex items-start gap-2">
                                        <Users className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-900 mb-1">Instructor Change</div>
                                            <p className="text-sm text-gray-600">
                                                Session Instructor: {instructorName}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!isCancelled && originalRoom && (
                                    <div className="flex items-start gap-2">
                                        <MapPin className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-900 mb-1">Room Change</div>
                                            <p className="text-sm text-gray-600">
                                                Session Room: {room}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {isCancelledReschedule && (
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-2">
                                                <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-gray-900 mb-1">
                                                        Class Cancelled
                                                    </div>
                                                    {cancellationReason && (
                                                        <p className="text-sm text-gray-600">
                                                            {cancellationReason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (onUndoCancel) onUndoCancel();
                                                    onClose();
                                                }}
                                                className="w-full"
                                            >
                                                {cancellationActionLabel}
                                            </Button>
                                        </div>
                                        {rescheduledDate && (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <CalendarClock className="size-4 text-blue-700 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-gray-900 mb-1">
                                                            Rescheduled Class
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            Originally scheduled for{' '}
                                                            {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                                weekday: 'long',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (onUndoReschedule) onUndoReschedule();
                                                        onClose();
                                                    }}
                                                    className="w-full"
                                                >
                                                    Undo Reschedule
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isRescheduledFrom && !isRescheduledTo && rescheduledDate && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="size-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-900 mb-1">
                                                    Class Rescheduled
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    Moved to{' '}
                                                    {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                        weekday: 'long',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                void handleUndo();
                                            }}
                                            className="w-full"
                                        >
                                            Undo Reschedule
                                        </Button>
                                    </div>
                                )}

                                {isRescheduledTo && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="size-4 text-blue-700 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-900 mb-1">
                                                    Rescheduled Class
                                                </div>
                                                {rescheduledDate && (
                                                    <p className="text-sm text-gray-600">
                                                        Originally scheduled for{' '}
                                                        {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                            weekday: 'long',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                void handleUndo();
                                            }}
                                            className="w-full"
                                        >
                                            Undo Reschedule
                                        </Button>
                                    </div>
                                )}

                                {isCancelled && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-900 mb-1">
                                                    Class Cancelled
                                                </div>
                                                {cancellationReason && (
                                                    <p className="text-sm text-gray-600">
                                                        {cancellationReason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                void handleUndo();
                                            }}
                                            className="w-full"
                                        >
                                            {cancellationActionLabel}
                                        </Button>
                                    </div>
                                )}

                                {hasAttendance && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle className="size-4 text-[#556830] mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-[#556830] mb-1">
                                                    Attendance Taken
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    This class cannot be
                                                    modified because attendance
                                                    has been recorded.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>
                        )}

                        {(canModify || showTakeAttendance) && (
                            <div className="pt-6 border-t border-gray-200">
                                <h4 className="text-sm text-gray-700 mb-3">
                                    Actions
                                </h4>
                                <div className="space-y-2">
                                    {showTakeAttendance && onTakeAttendance && (
                                        <Button
                                            className="w-full justify-start bg-[#556830] hover:bg-[#203622] text-white"
                                            onClick={onTakeAttendance}
                                        >
                                            <CheckCircle className="size-4 mr-2" />
                                            Take Attendance
                                        </Button>
                                    )}
                                    {canModify && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    if (onReschedule) {
                                                        onReschedule();
                                                    } else {
                                                        setShowRescheduleModal(true);
                                                    }
                                                }}
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <CalendarClock className="size-4 mr-2" />
                                                Reschedule This Class
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setShowCancelModal(true)
                                                }
                                                className="w-full justify-start border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                            >
                                                <CalendarOff className="size-4 mr-2" />
                                                Cancel This Class
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setShowChangeInstructor(true)
                                                }
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <Users className="size-4 mr-2" />
                                                Change Instructor
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setShowChangeRoom(true)
                                                }
                                                className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                            >
                                                <MapPin className="size-4 mr-2" />
                                                Change Room
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {onViewClassDetails && !isCancelled && (
                            <div className="pt-6 border-t border-gray-200">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={onViewClassDetails}
                                >
                                    View Full Class Details →
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <CancelEventModal
                open={showCancelModal}
                onOpenChange={setShowCancelModal}
                event={facilityEvent}
                onSuccess={() => {
                    onClose();
                    onMutate();
                }}
            />

            {showRescheduleModal && !onReschedule && (
                <RescheduleSessionModal
                    open={showRescheduleModal}
                    onClose={() => setShowRescheduleModal(false)}
                    classId={classId}
                    eventId={eventId}
                    originalDate={instance.date}
                    dateLabel={shortDateLabel}
                    currentRoom={room}
                    classTime={classTime}
                    onRescheduled={() => {
                        onClose();
                        onMutate();
                    }}
                    futureSessions={futureSessions.map((s) => ({
                        date: s.date,
                        eventId: s.eventId
                    }))}
                />
            )}

            <ChangeInstructorModal
                open={showChangeInstructor}
                onOpenChange={setShowChangeInstructor}
                event={facilityEvent}
                facilityId={facilityId}
                onSuccess={() => {
                    onClose();
                    onMutate();
                }}
            />

            <ChangeRoomModal
                open={showChangeRoom}
                onOpenChange={setShowChangeRoom}
                event={facilityEvent}
                rooms={rooms}
                onSuccess={() => {
                    onClose();
                    onMutate();
                }}
            />
        </>
    );
}
