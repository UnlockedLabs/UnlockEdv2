import { ServerResponseMany } from '@/common';
import { CancelButton, CloseX } from '@/Components/inputs';
import { RestoreClassEventModal, showModal } from '@/Components/modals';
import { CancelClassEventModal } from '@/Components/modals/CancelClassEventModal';
import { RescheduleClassEventModal } from '@/Components/modals/RescheduleClassEventModal';
import { RescheduleClassEventSeriesModal } from '@/Components/modals/RescheduleClassEventSeriesModal';
import { FacilityProgramClassEvent } from '@/types/events';
import { isAdministrator, useAuth } from '@/useAuth';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { KeyedMutator } from 'swr';

interface ClassEventDetailsCardProps {
    classId?: string;
    event: FacilityProgramClassEvent | null;
    mutateEvents: KeyedMutator<ServerResponseMany<FacilityProgramClassEvent>>;
    toolTip: string;
    clearSelectedEvent: () => void;
    readOnly: boolean;
    showAllClasses?: boolean;
    setShowAllClasses?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ClassEventDetailsCard({
    classId,
    event,
    mutateEvents,
    toolTip,
    clearSelectedEvent,
    readOnly,
    showAllClasses,
    setShowAllClasses
}: ClassEventDetailsCardProps) {
    const { user } = useAuth();
    const rescheduleClassEventSeriesModal = useRef<HTMLDialogElement>(null);
    const cancelClassEventModal = useRef<HTMLDialogElement>(null);
    const rescheduleClassEventModal = useRef<HTMLDialogElement>(null);
    const restoreClassEventModal = useRef<HTMLDialogElement>(null);

    function parseEnrolledNames(enrolledResidents: string) {
        if (enrolledResidents == '') return <p>No residents enrolled</p>;
        return (
            <div>
                {enrolledResidents.split('|').map((resident, index) => {
                    const residentName = resident.split(':')[1];
                    return <p key={index}>{residentName}</p>;
                })}
            </div>
        );
    }

    function canUpdateEvent(): boolean {
        if (!event || event.is_override) {
            return false;
        }
        if (classId && event.class_id.toString() !== classId) return false;
        return true;
    }

    function renderButtons() {
        const eventType = !event?.is_override
            ? 'series'
            : event?.is_cancelled
              ? 'canceled'
              : 'rescheduled';
        switch (eventType) {
            case 'series':
                return (
                    <>
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() => showModal(rescheduleClassEventModal)}
                            data-tip={toolTip}
                        >
                            Edit Event
                        </button>
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button-outline${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() =>
                                showModal(rescheduleClassEventSeriesModal)
                            }
                            data-tip={toolTip}
                        >
                            Edit Series
                        </button>
                        <div
                            className={`flex flex-col w-full${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            data-tip={toolTip}
                        >
                            <CancelButton
                                disabled={!canUpdateEvent()}
                                onClick={() => showModal(cancelClassEventModal)}
                            />
                        </div>
                    </>
                );
            case 'canceled':
                return (
                    <button
                        className={`button-outline${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                        onClick={() => showModal(restoreClassEventModal)}
                        data-tip={toolTip}
                    >
                        Restore Event
                    </button>
                );
            case 'rescheduled':
                return (
                    <>
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() => showModal(rescheduleClassEventModal)}
                            data-tip={toolTip}
                        >
                            Edit Event
                        </button>
                        <button
                            className="button-outline"
                            onClick={() => showModal(restoreClassEventModal)}
                        >
                            Restore Event
                        </button>
                        <div
                            className={`flex flex-col w-full${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            data-tip={toolTip}
                        >
                            <CancelButton
                                disabled={!canUpdateEvent()}
                                onClick={() => showModal(cancelClassEventModal)}
                            />
                        </div>
                    </>
                );
            default:
                return '';
        }
    }

    return (
        <>
            {classId && showAllClasses !== undefined && setShowAllClasses && (
                <div className="mb-2">
                    <input
                        type="checkbox"
                        checked={showAllClasses}
                        className="checkbox checkbox-sm mr-2"
                        onChange={(e) => setShowAllClasses(e.target.checked)}
                    />
                    <label className="body">Show other classes</label>
                </div>
            )}
            <div className="card p-4 h-full">
                {event ? (
                    <div className="flex flex-col gap-2 h-[600px]">
                        <div>
                            <h2 className="text-lg">Event Details</h2>
                            <CloseX close={clearSelectedEvent} />
                        </div>

                        <div className="space-y-2 overflow-y-scroll h-full">
                            <h3>Program Name</h3>
                            {isAdministrator(user) ? (
                                <Link
                                    to={`/programs/${event.program_id}`}
                                    className="link"
                                >
                                    {event.program_name}
                                </Link>
                            ) : (
                                <p>{event.program_name}</p>
                            )}
                            <h3>Class Name</h3>
                            {isAdministrator(user) ? (
                                <Link
                                    to={`/program-classes/${event.class_id}/dashboard`}
                                    className="link"
                                >
                                    {event.title}
                                </Link>
                            ) : (
                                <p>{event.title}</p>
                            )}
                            <h3>Instructor</h3>
                            <p>{event.instructor_name}</p>
                            <h3>Room</h3>
                            <p>{event.room}</p>
                            <h3>Time</h3>
                            <p>
                                {event.start.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}{' '}
                                -{' '}
                                {event.end.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            <h3>Frequency</h3>
                            <p>{event.frequency}</p>
                            <h3>Enrolled Residents</h3>
                            {parseEnrolledNames(event.enrolled_users)}
                        </div>
                        {!readOnly && (
                            <div className="space-y-2 flex flex-col w-full min-h-[150px]">
                                {renderButtons()}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="my-auto body text-center">
                        Select an event to view details, make changes, or cancel
                        a session.
                    </p>
                )}
                {event && (
                    <CancelClassEventModal
                        mutate={mutateEvents}
                        calendarEvent={event}
                        ref={cancelClassEventModal}
                        handleCallback={clearSelectedEvent}
                    />
                )}
                {event && (
                    <RescheduleClassEventSeriesModal
                        key={Date.now()}
                        mutate={mutateEvents}
                        calendarEvent={event}
                        ref={rescheduleClassEventSeriesModal}
                        handleCallback={clearSelectedEvent}
                    />
                )}
                {event && (
                    <RescheduleClassEventModal
                        mutate={mutateEvents}
                        calendarEvent={event}
                        ref={rescheduleClassEventModal}
                        handleCallback={clearSelectedEvent}
                    />
                )}
                {event && (
                    <RestoreClassEventModal
                        mutate={mutateEvents}
                        calendarEvent={event}
                        ref={restoreClassEventModal}
                        handleCallback={clearSelectedEvent}
                    />
                )}
            </div>
        </>
    );
}
