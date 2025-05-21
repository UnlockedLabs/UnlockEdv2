import { FacilityProgramClassEvent } from '@/common';
import EventCalendar from '@/Components/EventCalendar';
import { CancelButton } from '@/Components/inputs';
import { useState } from 'react';
import { useLoaderData } from 'react-router-dom';

export default function Schedule() {
    const events = useLoaderData() as FacilityProgramClassEvent[];
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);

    const formattedEvents = events.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
    }));

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
                    <div className="flex flex-col justify-between gap-2 h-full">
                        <div className="space-y-2">
                            <h2 className="text-lg">Event Details</h2>
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
                        </div>
                        <div className="space-y-2 flex flex-col w-full">
                            <button className="button">Edit Event</button>
                            <button className="button-outline">
                                Edit Series
                            </button>
                            <CancelButton
                                onClick={() => setSelectedEvent(null)}
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
        </div>
    );
}
