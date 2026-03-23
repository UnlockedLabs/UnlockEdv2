import { useState, useMemo } from 'react';
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
import { CancelSessionModal } from './CancelSessionModal';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import {
    ChangeInstructorModal,
    ChangeInstructorSession
} from './ChangeInstructorModal';
import { ChangeRoomModal, ChangeRoomSession } from './ChangeRoomModal';
import { SessionDisplay } from './SessionsTab';

interface SessionDetailSheetProps {
    session: SessionDisplay | null;
    onClose: () => void;
    className: string;
    classTime: string;
    room: string;
    classId: number;
    onMutate: () => void;
    onUndo: () => void;
    allSessions?: SessionDisplay[];
}

export function SessionDetailSheet({
    session,
    onClose,
    className,
    classTime,
    room,
    classId,
    onMutate,
    onUndo,
    allSessions = []
}: SessionDetailSheetProps) {
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showChangeInstructor, setShowChangeInstructor] = useState(false);
    const [showChangeRoom, setShowChangeRoom] = useState(false);
    const [applyToFuture, setApplyToFuture] = useState(false);

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
        rescheduledDate,
        hasAttendance,
        isToday
    } = session;

    const canModify =
        !hasAttendance &&
        !isCancelled &&
        !isRescheduledFrom &&
        (session.isUpcoming || session.isToday);

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

    const getStatusBadge = () => {
        if (isCancelled) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-700 border-gray-300"
                >
                    Cancelled
                </Badge>
            );
        }
        if (isRescheduledFrom) {
            return (
                <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-600 border-gray-300"
                >
                    Rescheduled
                </Badge>
            );
        }
        if (isRescheduledTo) {
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

    const buildPayload = (s: SessionDisplay) => ({
        date: s.instance.date,
        dateLabel: s.dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        }),
        eventId: s.instance.event_id ?? s.instance.id,
        classTime: s.instance.class_time,
        dateObj: s.dateObj,
        dayName: s.dateObj.toLocaleDateString('en-US', { weekday: 'long' })
    });

    const currentPayload = buildPayload(session);

    const changeInstructorSessions: ChangeInstructorSession[] = [
        currentPayload
    ];
    const changeRoomSessions: ChangeRoomSession[] = [currentPayload];

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
                                className={`text-[#203622] mb-2 ${isCancelled || isRescheduledFrom ? 'line-through' : ''}`}
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
                                            {className}
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
                                            className={`text-[#203622] ${isCancelled || isRescheduledFrom ? 'line-through' : ''}`}
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
                                            className={`text-[#203622] ${isCancelled || isRescheduledFrom ? 'line-through' : ''}`}
                                        >
                                            {room}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(isCancelled || isRescheduledFrom || isRescheduledTo || hasAttendance) && (
                            <div className="pt-6 border-t border-gray-200">
                                <h4 className="text-sm text-gray-700 mb-3">
                                    Status
                                </h4>

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

                                {isRescheduledTo && rescheduledDate && (
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
                                            Undo Cancellation
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
                        )}

                        {canModify && (
                            <div className="pt-6 border-t border-gray-200">
                                <h4 className="text-sm text-gray-700 mb-3">
                                    Actions
                                </h4>
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setShowRescheduleModal(true)
                                        }
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
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {showCancelModal && (
                <CancelSessionModal
                    open={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    classId={classId}
                    eventId={eventId}
                    date={instance.date}
                    dateLabel={shortDateLabel}
                    onCancelled={() => {
                        setApplyToFuture(false);
                        onClose();
                        onMutate();
                    }}
                    applyToFuture={applyToFuture}
                    setApplyToFuture={setApplyToFuture}
                    futureSessions={futureSessions.map((s) => ({
                        date: s.date,
                        eventId: s.eventId
                    }))}
                />
            )}

            {showRescheduleModal && (
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
                        setApplyToFuture(false);
                        onClose();
                        onMutate();
                    }}
                    applyToFuture={applyToFuture}
                    setApplyToFuture={setApplyToFuture}
                    futureSessions={futureSessions.map((s) => ({
                        date: s.date,
                        eventId: s.eventId
                    }))}
                />
            )}

            {showChangeInstructor && (
                <ChangeInstructorModal
                    open={showChangeInstructor}
                    onClose={() => setShowChangeInstructor(false)}
                    classId={classId}
                    sessions={changeInstructorSessions}
                    futureSessions={futureSessions}
                    onChanged={() => {
                        setApplyToFuture(false);
                        onClose();
                        onMutate();
                    }}
                    applyToFuture={applyToFuture}
                    setApplyToFuture={setApplyToFuture}
                />
            )}

            {showChangeRoom && (
                <ChangeRoomModal
                    open={showChangeRoom}
                    onClose={() => setShowChangeRoom(false)}
                    classId={classId}
                    sessions={changeRoomSessions}
                    futureSessions={futureSessions}
                    onChanged={() => {
                        setApplyToFuture(false);
                        onClose();
                        onMutate();
                    }}
                    applyToFuture={applyToFuture}
                    setApplyToFuture={setApplyToFuture}
                />
            )}
        </>
    );
}
