import { useMemo, useState } from 'react';
import useSWR from 'swr';
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
import { SessionDetailHeader } from './SessionDetailHeader';
import { SessionDetailClassDetails } from './SessionDetailClassDetails';
import { SessionDetailStatusSection } from './SessionDetailStatusSection';
import { SessionDetailActions } from './SessionDetailActions';
import {
    buildFacilityEvent,
    type SessionDisplay
} from '@/pages/class-detail/session-utils';
import {
    FacilityProgramClassEvent,
    ProgramClassEvent,
    Room,
    ServerResponseMany
} from '@/types';

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

                    <SessionDetailHeader
                        dateLabel={dateLabel}
                        isToday={isToday}
                        isCancelled={isCancelled}
                        isCancelledReschedule={isCancelledReschedule}
                        isRescheduledFrom={isRescheduledFrom}
                        isRescheduledTo={isRescheduledTo}
                        hasAttendance={hasAttendance}
                        isUpcoming={session.isUpcoming}
                        hideRescheduledBadge={hideRescheduledBadge}
                        showActiveBadge={showActiveBadge}
                    />


                    <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto min-h-0">
                        <SessionDetailClassDetails
                            className={className}
                            programName={programName}
                            classTime={classTime}
                            room={room}
                            originalRoom={originalRoom}
                            instructorName={instructorName}
                            originalInstructorName={originalInstructorName}
                            isCancelled={isCancelled}
                            isRescheduledFrom={isRescheduledFrom}
                            isCancelledReschedule={isCancelledReschedule}
                        />

                        <SessionDetailStatusSection
                            isCancelled={isCancelled}
                            isCancelledReschedule={isCancelledReschedule}
                            isRescheduledFrom={isRescheduledFrom}
                            isRescheduledTo={isRescheduledTo}
                            hasAttendance={hasAttendance}
                            originalInstructorName={originalInstructorName}
                            instructorName={instructorName}
                            originalRoom={originalRoom}
                            room={room}
                            cancellationReason={cancellationReason}
                            rescheduledDate={rescheduledDate}
                            cancellationActionLabel={cancellationActionLabel}
                            onUndo={handleUndo}
                            onUndoCancel={onUndoCancel}
                            onUndoReschedule={onUndoReschedule}
                            onClose={onClose}
                        />

                        <SessionDetailActions
                            canModify={canModify}
                            showTakeAttendance={showTakeAttendance}
                            isCancelled={isCancelled}
                            onTakeAttendance={onTakeAttendance}
                            onRescheduleClick={() => {
                                if (onReschedule) onReschedule();
                                else setShowRescheduleModal(true);
                            }}
                            onCancelClick={() => setShowCancelModal(true)}
                            onChangeInstructorClick={() =>
                                setShowChangeInstructor(true)
                            }
                            onChangeRoomClick={() => setShowChangeRoom(true)}
                            onViewClassDetails={onViewClassDetails}
                        />
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
