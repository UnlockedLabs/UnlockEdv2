import { Class } from '@/types/program';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import { CancelEventModal } from '@/components/schedule/CancelEventModal';
import {
    BulkCancelSessionsModal,
    BulkCancelSession
} from './BulkCancelSessionsModal';
import {
    ChangeInstructorModal,
    ChangeInstructorSession
} from './ChangeInstructorModal';
import { ChangeRoomModal, ChangeRoomSession } from './ChangeRoomModal';
import { SessionDetailSheet } from '@/components/schedule/SessionDetailSheet';
import {
    buildFacilityEvent,
    getSessionChangeInfo,
    type SessionDisplay
} from './session-utils';
import { getInstructorName } from '@/lib/formatters';

interface SessionsTabModalsProps {
    cls: Class;
    allSessions: SessionDisplay[];
    roomOverrides: Map<string, string>;

    rescheduleTarget: SessionDisplay | null;
    onCloseReschedule: () => void;

    quickCancelSession: SessionDisplay | null;
    showQuickCancel: boolean;
    onQuickCancelOpenChange: (open: boolean) => void;
    onQuickCancelSuccess: () => void;

    showBulkCancelModal: boolean;
    onBulkCancelOpenChange: (open: boolean) => void;
    cancelSessions: BulkCancelSession[];
    onBulkCancelled: () => void;

    showChangeInstructor: boolean;
    onCloseChangeInstructor: () => void;
    changeInstructorSessions: ChangeInstructorSession[];
    onInstructorChanged: () => void;

    showChangeRoom: boolean;
    onCloseChangeRoom: () => void;
    changeRoomSessions: ChangeRoomSession[];
    onRoomChanged: () => void;

    selectedSession: SessionDisplay | null;
    onCloseDetailSheet: () => void;
    onMutate: () => void;
    onSelectedSessionUndo: () => void;
    onSelectedSessionUndoCancel: () => void;
    onSelectedSessionUndoReschedule: () => void;
}

export function SessionsTabModals({
    cls,
    allSessions,
    roomOverrides,
    rescheduleTarget,
    onCloseReschedule,
    quickCancelSession,
    showQuickCancel,
    onQuickCancelOpenChange,
    onQuickCancelSuccess,
    showBulkCancelModal,
    onBulkCancelOpenChange,
    cancelSessions,
    onBulkCancelled,
    showChangeInstructor,
    onCloseChangeInstructor,
    changeInstructorSessions,
    onInstructorChanged,
    showChangeRoom,
    onCloseChangeRoom,
    changeRoomSessions,
    onRoomChanged,
    selectedSession,
    onCloseDetailSheet,
    onMutate,
    onSelectedSessionUndo,
    onSelectedSessionUndoCancel,
    onSelectedSessionUndoReschedule
}: SessionsTabModalsProps) {
    const changeInfo = selectedSession
        ? getSessionChangeInfo(cls.events ?? [], selectedSession.instance.date)
        : {};
    const baseRoom =
        (selectedSession
            ? roomOverrides.get(
                  `${selectedSession.instance.date}|${selectedSession.instance.class_time?.split('-')[0]}`
              ) ?? roomOverrides.get(selectedSession.instance.date)
            : undefined) ??
        cls.events?.[0]?.room_ref?.name ??
        'TBD';
    const baseInstructor = getInstructorName(cls.events ?? []);

    return (
        <>
            {rescheduleTarget && (
                <RescheduleSessionModal
                    open={!!rescheduleTarget}
                    onClose={onCloseReschedule}
                    classId={cls.id}
                    eventId={
                        rescheduleTarget.instance.event_id ??
                        rescheduleTarget.instance.id
                    }
                    originalDate={rescheduleTarget.instance.date}
                    dateLabel={rescheduleTarget.dateObj.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    currentRoom={cls.events?.[0]?.room_ref?.name}
                    classTime={rescheduleTarget.instance.class_time}
                    onRescheduled={onMutate}
                />
            )}

            {showQuickCancel && quickCancelSession && (
                <CancelEventModal
                    open={showQuickCancel}
                    onOpenChange={onQuickCancelOpenChange}
                    event={buildFacilityEvent(quickCancelSession, cls.id, cls.events ?? [])}
                    onSuccess={onQuickCancelSuccess}
                    showApplyToFuture={false}
                />
            )}

            <BulkCancelSessionsModal
                open={showBulkCancelModal}
                onOpenChange={onBulkCancelOpenChange}
                classId={cls.id}
                sessions={cancelSessions}
                onCancelled={onBulkCancelled}
            />

            {showChangeInstructor && (
                <ChangeInstructorModal
                    open={showChangeInstructor}
                    onClose={onCloseChangeInstructor}
                    classId={cls.id}
                    sessions={changeInstructorSessions}
                    onChanged={onInstructorChanged}
                    showSessionsList
                />
            )}

            {showChangeRoom && (
                <ChangeRoomModal
                    open={showChangeRoom}
                    onClose={onCloseChangeRoom}
                    classId={cls.id}
                    sessions={changeRoomSessions}
                    onChanged={onRoomChanged}
                    showSessionsList
                />
            )}

            <SessionDetailSheet
                session={selectedSession}
                onClose={onCloseDetailSheet}
                className={cls.name}
                facilityId={String(cls.facility_id)}
                classEvents={cls.events ?? []}
                classTime={
                    selectedSession?.instance.class_time ??
                    cls.events?.[0]?.duration ??
                    ''
                }
                room={changeInfo.newRoom ?? baseRoom}
                originalRoom={changeInfo.originalRoom}
                instructorName={changeInfo.newInstructor ?? baseInstructor}
                originalInstructorName={changeInfo.originalInstructor}
                classId={cls.id}
                onMutate={onMutate}
                onUndo={onSelectedSessionUndo}
                onUndoCancel={onSelectedSessionUndoCancel}
                onUndoReschedule={onSelectedSessionUndoReschedule}
                allSessions={allSessions}
            />
        </>
    );
}
