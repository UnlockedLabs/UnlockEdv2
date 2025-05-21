import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { FacilityProgramClassEvent, ShortCalendarEvent } from '@/common';

const localizer = momentLocalizer(moment);

interface EventCalendarProps {
    events: FacilityProgramClassEvent[] | ShortCalendarEvent[];
    view?: View;
    handleDateClick?: (event: FacilityProgramClassEvent) => void;
}

export default function EventCalendar({
    events,
    view = 'month',
    handleDateClick
}: EventCalendarProps) {
    const eventPropGetter = (event: FacilityProgramClassEvent) => {
        if (event.is_cancelled) {
            return {
                className: 'rbc-event-cancelled'
            };
        }
        return {};
    };
    return (
        <div className="p-4">
            <Calendar
                localizer={localizer}
                events={events as FacilityProgramClassEvent[]}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                defaultView={view}
                onSelectEvent={handleDateClick}
                eventPropGetter={eventPropGetter}
            />
        </div>
    );
}
