import { FacilityProgramClassEvent, ServerResponseMany } from '@/common';
import EventCalendar from '@/Components/EventCalendar';
import ResidentPrograms from '@/Components/ResidentPrograms';
import { useAuth } from '@/useAuth';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { toZonedTime } from 'date-fns-tz';
import { CloseX } from '@/Components/inputs';

export default function ResidentOverview() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [showAllClasses, setShowAllClasses] = useState(false);
    const user_id = user?.id;
    const { class_id } = useParams<{ class_id?: string }>();
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);
    const { data: eventsResp } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>,
        Error
    >(
        `/api/student-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}${class_id && !showAllClasses ? '&class_id=' + class_id : ''}`
    );
    const events = eventsResp?.data;
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);
    function clearSelectedEvent() {
        const selectedElement = document.querySelector<HTMLElement>(
            '.rbc-event.rbc-selected'
        );
        if (selectedElement) {
            selectedElement.classList.remove('rbc-selected');
        }
        setSelectedEvent(null);
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

    return (
        <div className="px-5">
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
                                <label className="body">
                                    Show other classes
                                </label>
                            </div>
                        </>
                    )}
                    <div className="card p-4 h-full">
                        {selectedEvent ? (
                            <div className="flex flex-col gap-2 h-[600px]">
                                <div>
                                    <h2 className="text-lg">Event Details</h2>
                                    <CloseX
                                        close={() => clearSelectedEvent()}
                                    />
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
                                        {selectedEvent.end.toLocaleTimeString(
                                            [],
                                            {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }
                                        )}
                                    </p>
                                    <h3>Frequency</h3>
                                    <p>{selectedEvent.frequency}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="my-auto body text-center">
                                Select an event to view details.
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="card card-row-padding col-span-2 w-full mt-4">
                <ResidentPrograms user_id={user_id?.toString() ?? ''} />
            </div>
        </div>
    );
}
