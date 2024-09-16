import Calendar from 'react-calendar';
import API from '@/api/api.ts';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import { Event, EventCalendar } from '@/common';
import { Value } from 'node_modules/react-calendar/dist/esm/shared/types';
import Modal, { ModalType } from './Modal';
import ShowEventsForDateModal from './forms/ShowSectionEventForm';
import '@/css/app.css';

function CalendarComponent() {
    const eventModal = useRef<null | HTMLDialogElement>(null);
    const [eventsMap, setEventsMap] = useState({});
    const [date, setDate] = useState(new Date());
    const [selectedEvents, setSelectedEvents] = useState<Event[]>(null);

    const onChange = (value: Value, event: MouseEvent) => {
        event.preventDefault();
        setDate(value as Date);
    };
    const handleCloseModal = () => {
        setSelectedEvents(null);
        eventModal.current.close();
    };

    useEffect(() => {
        API.get<EventCalendar>(
            `admin-calendar?month=${date.getMonth() + 1}&year=${date.getFullYear()}`
        )
            .then((response) => {
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
            eventModal.current.showModal();
        }
    };
    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dateKey = date.toISOString().substring(0, 10);
            if (eventsMap[dateKey] && eventsMap[dateKey].length > 0) {
                return 'has-events';
            }
        }
        return null;
    };
    return (
        <div className="w-full max-w-xs text-xs calendar-wrapper">
            <Calendar
                value={date}
                onChange={onChange}
                onClickDay={onClickDay}
                tileClassName={tileClassName}
                className="react-calendar"
                view="month"
            />
            {selectedEvents && (
                <Modal
                    item={'events'}
                    type={ModalType.Show}
                    ref={eventModal}
                    form={
                        <ShowEventsForDateModal
                            events={selectedEvents}
                            onClose={handleCloseModal}
                        />
                    }
                />
            )}
        </div>
    );
}

export default CalendarComponent;
