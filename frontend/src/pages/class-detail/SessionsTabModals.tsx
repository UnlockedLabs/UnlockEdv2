import { Class } from '@/types/program';
import { FacilityProgramClassEvent, ProgramClassEvent } from '@/types/events';
import { SelectedClassStatus } from '@/types/attendance';
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
    findActiveOverride,
    getSessionChangeInfo,
    type SessionDisplay
} from './session-utils';
import { getInstructorName } from '@/lib/formatters';

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
        linked_override_event: null,
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
