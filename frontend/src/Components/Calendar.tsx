import Calendar, { TileArgs } from 'react-calendar';
import API from '@/api/api.ts';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import {
    Event,
    EventCalendar,
    ModalType,
    parseDuration,
    UserRole
} from '@/common';
import '@/css/app.css';
import { OnArgs } from 'node_modules/react-calendar/dist/cjs';
import Modal from './Modal';
import EditEventForm from './forms/EditEventForm.tsx';
import { useAuth } from '@/useAuth';

function CalendarComponent() {
    const user = useAuth().user;
    const editModal = useRef<HTMLDialogElement>(null);
    const [eventsMap, setEventsMap] = useState<Map<string, Event[]>>(new Map());
    const [date, setDate] = useState(new Date());
    const [selectedEvents, setSelectedEvents] = useState<Event[] | undefined>();
    const [eventToEdit, setEventToEdit] = useState<Event>();
    const YEAR_IDX = 10;
    const onMonthChange = ({ activeStartDate }: OnArgs) => {
        setDate(activeStartDate!);
    };

    const getSelectedDate = (event: string): string => {
        const eventDate = new Date(event);
        return eventDate.toISOString().slice(0, YEAR_IDX);
    };

    useEffect(() => {
        if (user == undefined) return;
        const url =
            user.role === UserRole.Admin
                ? 'admin-calendar'
                : 'student-calendar';
        API.get<EventCalendar>(
            `${url}?month=${date.getMonth() + 1}&year=${date.getFullYear()}`
        )
            .then((response) => {
                const data = response.data as EventCalendar;
                const eventsByDate = new Map<string, Event[]>();
                data.month.days.forEach((day) => {
                    const dateKey = day.date.slice(0, YEAR_IDX);
                    eventsByDate.set(dateKey, day.events);
                });
                setEventsMap(eventsByDate);
            })
            .catch((error) => {
                console.error('Error fetching calendar data:', error);
            });
    }, [date, user?.role]);

    const onClickDay = (clickedDate: Date) => {
        const dateKey = clickedDate.toISOString().slice(0, YEAR_IDX);
        const events = eventsMap.get(dateKey);
        if (events && events.length > 0) {
            setSelectedEvents(events);
        } else setSelectedEvents(undefined);
    };
    const tileClassName = ({ date, view }: TileArgs) => {
        if (view === 'month') {
            const dateKey = date.toISOString().slice(0, YEAR_IDX);
            if (eventsMap.get(dateKey)) {
                return '!bg-teal-1';
            }
        }
        return;
    };

    const openEditModal = (e: MouseEvent, event: Event) => {
        e.preventDefault();
        setEventToEdit(event);
        editModal.current?.showModal();
    };

    const handleCloseModal = () => {
        setEventToEdit(undefined);
        editModal.current?.close();
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="w-full calendar-wrapper card">
                <h2 className="card-h-padding">Calendar</h2>
                <Calendar
                    value={date}
                    onActiveStartDateChange={onMonthChange}
                    onClickDay={onClickDay}
                    tileClassName={tileClassName}
                    className="react-calendar p-4"
                    view="month"
                />
            </div>
            <div className="card h-full">
                <h2 className="card-h-padding">
                    Scheduled Events for{' '}
                    {selectedEvents
                        ? `${getSelectedDate(selectedEvents[0].start_time)}`
                        : `${date.toISOString().slice(0, YEAR_IDX)}`}
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
                                    {user?.role === UserRole.Admin && (
                                        <button
                                            onClick={(e) =>
                                                openEditModal(e, event)
                                            }
                                            className="btn btn-xs btn-primary mt-2"
                                        >
                                            Edit Event
                                        </button>
                                    )}
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
            {}
            {eventToEdit && (
                <Modal
                    ref={editModal}
                    type={ModalType.Edit}
                    item="Event"
                    form={
                        <EditEventForm
                            event={eventToEdit}
                            onClose={handleCloseModal}
                        />
                    }
                />
            )}
        </div>
    );
}

export default CalendarComponent;
