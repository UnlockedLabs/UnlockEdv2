import Calendar from 'react-calendar';
import API from '@/api/api.ts';
import { MouseEvent, useEffect, useState } from 'react';
import { Event, EventCalendar } from '@/common';
import { Value } from 'node_modules/react-calendar/dist/esm/shared/types';
import '@/css/app.css';

function CalendarComponent() {
    const [eventsMap, setEventsMap] = useState({});
    const [date, setDate] = useState(new Date());
    const [selectedEvents, setSelectedEvents] = useState<Event[]>(null);

    const onChange = (value: Value, event: MouseEvent) => {
        event.preventDefault();
        setDate(value as Date);
    };

    useEffect(() => {
        API.get<EventCalendar>(
            `admin-calendar?month=${date.getMonth() + 1}&year=${date.getFullYear()}`
        )
            .then((response) => {
                console.log(response);
                const data = response.data as EventCalendar;
                const eventsByDate = {};
                data.month.days.forEach((day) => {
                    const dateKey = day.date.substring(0, 10);
                    eventsByDate[dateKey] = day.events;
                });
                setEventsMap(eventsByDate);
            })
            .catch((error) => {
                console.error('Error fetching calendar data:', error);
            });
    }, [date]);

    const onClickDay = (clickedDate: Date) => {
        const dateKey = clickedDate.toISOString().substring(0, 10);
        const events = eventsMap[dateKey];
        if (events && events.length > 0) {
            setSelectedEvents(events);
        } else setSelectedEvents(null);
    };
    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dateKey = date.toISOString().substring(0, 10);
            if (eventsMap[dateKey] && eventsMap[dateKey].length > 0) {
                return '!bg-teal-1';
            }
        }
        return null;
    };

    const parseDuration = (duration: number): string => {
        const hours = Math.floor(duration / 3.6e12);
        const minutes = Math.floor((duration % 3.6e12) / 6e10);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="w-full calendar-wrapper card">
                <h2 className="card-h-padding">Calendar</h2>
                <Calendar
                    value={date}
                    onChange={onChange}
                    onClickDay={onClickDay}
                    tileClassName={tileClassName}
                    className="react-calendar p-4"
                    view="month"
                />
            </div>
            <div className="card h-full">
                <h2 className="card-h-padding">
                    Scheduled Events for {`${date.toDateString()}`}
                </h2>
                <div className="p-4">
                    {selectedEvents ? (
                        <div className="flex flex-col space-y-4">
                            {selectedEvents.map((event: Event, idx: number) => (
                                <div
                                    key={idx}
                                    className="card shadow-lg border p-4 rounded-lg"
                                >
                                    <h3 className="card-title text-lg font-semibold">
                                        {event.program_name}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {event.is_cancelled ? (
                                            <span className="text-red-500">
                                                Cancelled
                                            </span>
                                        ) : (
                                            <span className="text-green-500">
                                                Scheduled
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-sm">
                                        <strong>Location:</strong>{' '}
                                        {event.location}
                                    </p>
                                    <p className="text-sm">
                                        <strong>Start Time:</strong>{' '}
                                        {new Date(
                                            event.start_time
                                        ).toLocaleString()}
                                    </p>
                                    <p className="text-sm">
                                        <strong>Duration:</strong>{' '}
                                        {parseDuration(event.duration)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="body">
                            No events scheduled on this date.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CalendarComponent;
