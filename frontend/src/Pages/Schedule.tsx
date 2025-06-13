import {
    ClassLoaderData,
    FacilityProgramClassEvent,
    ServerResponseMany
} from '@/common';
import EventCalendar from '@/Components/EventCalendar';
import { CancelButton, CloseX } from '@/Components/inputs';
import { showModal } from '@/Components/modals';
import { CancelClassEventModal } from '@/Components/modals/CancelClassEventModal';
import { RescheduleClassEventModal } from '@/Components/modals/RescheduleClassEventModal';
import { RescheduleClassEventSeriesModal } from '@/Components/modals/RescheduleClassEventSeriesModal';
import { useAuth } from '@/useAuth';
import { toZonedTime } from 'date-fns-tz';
import { useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

export default function Schedule() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [showAllClasses, setShowAllClasses] = useState(false);
    const navigate = useNavigate();
    const clsLoader = useLoaderData() as ClassLoaderData;
    if (clsLoader?.redirect) {
        navigate(clsLoader.redirect);
    }
    const toolTip = clsLoader
        ? `This event is from another class and cannot be edited on the ${clsLoader.class?.name} schedule.`
        : '';
    const { class_id } = useParams<{ class_id?: string }>();
    const rescheduleClassEventSeriesModal = useRef<HTMLDialogElement>(null);
    const cancelClassEventModal = useRef<HTMLDialogElement>(null);
    const rescheduleClassEventModal = useRef<HTMLDialogElement>(null);
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);
    const { data: eventsResp, mutate: mutateEvents } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>,
        Error
    >(
        `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}${class_id && !showAllClasses ? '&class_id=' + class_id : ''}`
    );
    const events = eventsResp?.data;
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);

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

    const formattedEvents = events
        ? events.map((event) => {
              return {
                  ...event,
                  start: toZonedTime(event.start, user?.timezone),
                  end: toZonedTime(new Date(event.end), user?.timezone)
              };
          })
        : [];

    function clearSelectedEvent() {
        const selectedElement = document.querySelector<HTMLElement>(
            '.rbc-event.rbc-selected'
        );
        if (selectedElement) {
            selectedElement.classList.remove('rbc-selected');
        }
        setSelectedEvent(null);
    }

    function canUpdateEvent(): boolean {
        if (!selectedEvent || selectedEvent.is_override) {
            return false;
        }
        if (class_id && selectedEvent.class_id.toString() != class_id)
            return false;
        return true;
    }

    return (
        <div className={`flex flex-col-2 gap-2${!class_id ? ' px-2' : ''}`}>
            <div className="w-3/4 card">
                <EventCalendar
                    classId={class_id}
                    events={formattedEvents}
                    view="week"
                    handleDateClick={(event) => setSelectedEvent(event)}
                />
            </div>
            <div className="w-1/4 flex flex-col gap-2">
                {class_id && (
                    <>
                        {' '}
                        <div>
                            <input
                                type="checkbox"
                                checked={showAllClasses}
                                className="checkbox checkbox-sm mr-2"
                                onChange={(e) => {
                                    setShowAllClasses(e.target.checked);
                                }}
                            />
                            <label className="body">Show other classes</label>
                        </div>
                    </>
                )}
                <div className="card p-4 h-full">
                    {selectedEvent ? (
                        <div className="flex flex-col justify-between gap-2 h-[600px]">
                            <div>
                                <h2 className="text-lg">Event Details</h2>
                                <CloseX close={() => clearSelectedEvent()} />
                            </div>
                            <div className="space-y-2 overflow-y-scroll">
                                <h3>Program Name</h3>
                                <p>{selectedEvent.program_name}</p>
                                <h3>Class Name</h3>
                                <p>{selectedEvent.title}</p>
                                <h3>Instructor</h3>
                                <p>{selectedEvent.instructor_name}</p>
                                <h3>Room</h3>
                                <p>{selectedEvent.room}</p>
                                <h3>Time</h3>
                                <p>
                                    {selectedEvent.start.toLocaleTimeString(
                                        [],
                                        {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }
                                    )}{' '}
                                    -{' '}
                                    {selectedEvent.end.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                                <h3>Frequency</h3>
                                <p>{selectedEvent.frequency}</p>
                                <h3>Enrolled Residents</h3>
                                {parseEnrolledNames(
                                    selectedEvent.enrolled_users
                                )}
                            </div>
                            <div className="space-y-2 flex flex-col w-full">
                                <button
                                    disabled={!canUpdateEvent()}
                                    className={`button${!canUpdateEvent() && toolTip != '' ? ' tooltip' : ''}`}
                                    onClick={() => {
                                        showModal(rescheduleClassEventModal);
                                    }}
                                    data-tip={toolTip}
                                >
                                    Edit Event
                                </button>
                                <button
                                    disabled={!canUpdateEvent()}
                                    className={`button-outline${!canUpdateEvent() && toolTip != '' ? ' tooltip' : ''}`}
                                    onClick={() => {
                                        showModal(
                                            rescheduleClassEventSeriesModal
                                        );
                                    }}
                                    data-tip={toolTip}
                                >
                                    Edit Series
                                </button>
                                <div
                                    className={`flex flex-col w-full${!canUpdateEvent() && toolTip != '' ? ' tooltip' : ''}`}
                                    data-tip={toolTip}
                                >
                                    <CancelButton
                                        disabled={!canUpdateEvent()}
                                        onClick={() => {
                                            showModal(cancelClassEventModal);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="my-auto body text-center">
                            Select an event to view details, make changes, or
                            cancel a session.
                        </p>
                    )}
                </div>
            </div>
            {selectedEvent && (
                <CancelClassEventModal
                    mutate={mutateEvents}
                    calendarEvent={selectedEvent}
                    ref={cancelClassEventModal}
                />
            )}
            {selectedEvent && (
                <RescheduleClassEventSeriesModal
                    key={Date.now()}
                    mutate={mutateEvents}
                    calendarEvent={selectedEvent}
                    ref={rescheduleClassEventSeriesModal}
                />
            )}
            {selectedEvent && (
                <RescheduleClassEventModal
                    mutate={mutateEvents}
                    calendarEvent={selectedEvent}
                    ref={rescheduleClassEventModal}
                />
            )}
        </div>
    );
}
