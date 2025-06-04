import { FacilityProgramClassEvent, ServerResponseMany } from '@/common';
import EventCalendar from '@/Components/EventCalendar';
import { CancelButton, CloseX } from '@/Components/inputs';
import { showModal } from '@/Components/modals';
import { CancelClassEventModal } from '@/Components/modals/CancelClassEventModal';
import { RescheduleClassEventModal } from '@/Components/modals/RescheduleClassEventModal';
import { RescheduleClassEventSeriesModal } from '@/Components/modals/RescheduleClassEventSeriesModal';
import { useAuth } from '@/useAuth';
import { toZonedTime } from 'date-fns-tz';
import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

export default function Schedule() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
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
        `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}`
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

    return (
        <div className="flex flex-col-2 gap-2 px-2">
            <div className="w-3/4 card">
                <EventCalendar
                    events={formattedEvents}
                    view="week"
                    handleDateClick={(event) => setSelectedEvent(event)}
                />
            </div>
            <div className="w-1/4 card p-4">
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
                                {selectedEvent.start.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}{' '}
                                -{' '}
                                {selectedEvent.end.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            <h3>Frequency</h3>
                            <p>{selectedEvent.frequency}</p>
                            <h3>Enrolled Residents</h3>
                            {parseEnrolledNames(selectedEvent.enrolled_users)}
                        </div>
                        <div className="space-y-2 flex flex-col w-full">
                            <button
                                className="button"
                                onClick={() => {
                                    if (
                                        !selectedEvent ||
                                        selectedEvent.is_override
                                    ) {
                                        return;
                                    }
                                    showModal(rescheduleClassEventModal);
                                }}
                            >
                                Edit Event
                            </button>
                            <button
                                className="button-outline"
                                onClick={() => {
                                    if (
                                        !selectedEvent ||
                                        selectedEvent.is_override
                                    ) {
                                        return;
                                    }
                                    showModal(rescheduleClassEventSeriesModal);
                                }}
                            >
                                Edit Series
                            </button>
                            <CancelButton
                                onClick={() => {
                                    if (
                                        !selectedEvent ||
                                        selectedEvent.is_override
                                    ) {
                                        return;
                                    }
                                    showModal(cancelClassEventModal);
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <p className="my-auto body text-center">
                        Select an event to view details, make changes, or cancel
                        a session.
                    </p>
                )}
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
