import { useState, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { RRule } from 'rrule';
import { Class, ProgramClassEvent, ServerResponseOne } from '@/common';
import { CancelClassEventModal } from './modals/CancelClassEventModal';
import { closeModal, showModal, TextModalType, TextOnlyModal } from './modals';
import { KeyedMutator } from 'swr';
import { CancelButton } from './inputs';
import { RescheduleClassEventModal } from './modals/RescheduleClassEventModal';

const localizer = momentLocalizer(moment);

export interface CalendarClassEvent {
    classEvent?: ProgramClassEvent;
    title: string;
    start: Date;
    end: Date;
    isOverride?: boolean;
    reason?: string;
    room?: string;
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
    const showActionButtons = useRef<HTMLDialogElement>(null);
    const cancelClassEventModal = useRef<HTMLDialogElement>(null);
    const rescheduleClassEventModal = useRef<HTMLDialogElement>(null);
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

        const overrideMap = new Map(
            eventOverrides.map((o) => {
                const overrideDate = RRule.fromString(
                    o.override_rrule
                ).all()[0];
                //separated all overrides by date
                return [overrideDate.toISOString(), o];
            })
        );

        const baseEvents = eventDates
            .map((date): CalendarClassEvent | null => {
                const override = overrideMap.get(date.toISOString());
                if (
                    override?.is_cancelled &&
                    override?.reason != 'rescheduled'
                ) {
                    //cancelled event
                    return {
                        title: 'CANCELLED',
                        start: date,
                        end: new Date(date.getTime() + durationMs),
                        isOverride: true,
                        reason: override.reason,
                        room: override.room
                    };
                }
                //don't display if cancelled due to rescheduling
                if (
                    override?.is_cancelled &&
                    override?.reason === 'rescheduled'
                ) {
                    return null;
                }

                return {
                    //my base events for now
                    title,
                    start: date,
                    end: new Date(date.getTime() + durationMs),
                    isOverride: false
                };
            }) //getting rid of the blanks
            .filter(
                (calEvent): calEvent is CalendarClassEvent => calEvent !== null
            );

        const rescheduledEvents = eventOverrides
            .filter((override) => !override.is_cancelled)
            .map((override) => {
                const overrideRule = RRule.fromString(override.override_rrule);
                const start = overrideRule.all()[0];
                const overrideDuration = parseDurationToMs(override.duration);
                //all rescheduled events
                return {
                    title,
                    start,
                    end: new Date(start.getTime() + overrideDuration),
                    location: override.room,
                    isOverride: true
                };
            });
        setEvents([...baseEvents, ...rescheduledEvents]);
    }, [recurrenceRule, durationStr, title, classEvent?.overrides]);

    function handleSelectEvent(event: CalendarClassEvent): void {
        if (classEvent) {
            event.classEvent = classEvent;
        } else {
            //if the event doesn't exist yet don't allow it to be cancelled.
            return;
        }
        if (event.isOverride) {
            return;
        }
        setSelectedEvent(event);
        showModal(showActionButtons);
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
            <TextOnlyModal
                ref={showActionButtons}
                type={TextModalType.Information}
                title={'Event Actions'}
                text={
                    <div className="col-span-4 flex justify-center gap-4 mt-4">
                        <CancelButton
                            label="Cancel Event"
                            onClick={() => {
                                showModal(cancelClassEventModal);
                                closeModal(showActionButtons);
                            }}
                        />
                        <CancelButton
                            label="Edit Event"
                            onClick={() => {
                                showModal(rescheduleClassEventModal);
                                closeModal(showActionButtons);
                            }}
                        />
                    </div>
                }
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => {}} //eslint-disable-line
            ></TextOnlyModal>
            <RescheduleClassEventModal
                key={Date.now()}
                mutate={mutate}
                calendarEvent={selectedEvent}
                ref={rescheduleClassEventModal}
            />
            <CancelClassEventModal
                mutate={mutate}
                calendarEvent={selectedEvent}
                ref={cancelClassEventModal}
            />
        </div>
    );
}
