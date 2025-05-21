import { useState, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { RRule } from 'rrule';
import {
    Class,
    ProgramClassEvent,
    ProgramClassEventOverride,
    ServerResponseOne
} from '@/common';
import { CancelClassEventModal } from './modals/CancelClassEventModal';
import { showModal } from './modals';
import { KeyedMutator } from 'swr';

const localizer = momentLocalizer(moment);

export interface CalendarClassEvent {
    classEvent?: ProgramClassEvent;
    title: string;
    start: Date;
    end: Date;
    isCancelled?: boolean;
    reason?: string;
    location?: string;
}

interface EventCalendarProps {
    recurrenceRule: string;
    durationStr: string;
    title?: string;
    classEvent?: ProgramClassEvent;
    mutate: KeyedMutator<ServerResponseOne<Class>>;
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
    title = 'Event',
    classEvent,
    mutate
}: EventCalendarProps) {
    const [events, setEvents] = useState<CalendarClassEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<
        CalendarClassEvent | undefined
    >();
    const cancelClassEventModal = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (!recurrenceRule || !durationStr) {
            return;
        }
        const durationMs = parseDurationToMs(durationStr);
        const cleanRule = recurrenceRule.replace(
            /DTSTART;TZID=Local:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleanRule);
        const eventDates = rule.between(
            new Date(),
            moment().add(1, 'year').toDate()
        );

        const eventOverrides = classEvent?.overrides ?? []; //overrides
        const generated = eventDates.map((eventDate) => {
            const override = findCancellationForEventDate(
                eventDate,
                eventOverrides
            );
            return {
                title: override ? 'CANCELLED' : title,
                start: eventDate,
                end: new Date(eventDate.getTime() + durationMs),
                isCancelled: override?.is_cancelled,
                reason: override?.reason,
                location: override?.location
            };
        });
        setEvents(generated);
    }, [recurrenceRule, durationStr, title, classEvent?.overrides]);

    function findCancellationForEventDate(
        eventDate: Date,
        eventOverrides: ProgramClassEventOverride[]
    ): ProgramClassEventOverride | undefined {
        return eventOverrides.find((override) => {
            if (!override.is_cancelled) return false;
            const rule = RRule.fromString(override.override_rrule);
            const overrideDate = rule.all()[0];
            return overrideDate.toISOString() === eventDate.toISOString();
        });
    }

    function handleSelectEvent(event: CalendarClassEvent): void {
        if (classEvent) {
            event.classEvent = classEvent;
        } else {
            //if the event doesn't exist yet don't allow it to be cancelled.
            return;
        }
        if (event.isCancelled) {
            return;
        }
        setSelectedEvent(event);
        showModal(cancelClassEventModal);
    }

    return (
        <div className="p-4">
            <Calendar
                onSelectEvent={handleSelectEvent}
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
            />
            <CancelClassEventModal
                mutate={mutate}
                calendarEvent={selectedEvent}
                ref={cancelClassEventModal}
            />
        </div>
    );
}
