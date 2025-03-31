import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { RRule } from 'rrule';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
    title: string;
    start: Date;
    end: Date;
}

interface EventCalendarProps {
    recurrenceRule: string;
    durationStr: string;
    title?: string;
}

function parseDurationToMs(duration: string): number {
    const regex = /(\d+)h(\d+)m(\d)+s/;
    const groups = regex.exec(duration);

    if (!groups) return 0;

    const hours = parseInt(groups[1] || '0', 10);
    const minutes = parseInt(groups[2] || '0', 10);
    const seconds = parseInt(groups[3] || '0', 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000;
}

export default function EventCalendar({
    recurrenceRule,
    durationStr,
    title = 'Event'
}: EventCalendarProps) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        if (!recurrenceRule || !durationStr) {
            return;
        }
        const durationMs = parseDurationToMs(durationStr);
        const rule = RRule.fromString(recurrenceRule);
        const occurrences = rule.between(
            new Date(),
            moment().add(1, 'year').toDate()
        );
        const generated = occurrences.map((occurrence) => ({
            title,
            start: occurrence,
            end: new Date(occurrence.getTime() + durationMs)
        }));
        setEvents(generated);
    }, [recurrenceRule, durationStr, title]);

    return (
        <div className="p-4">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
            />
        </div>
    );
}
