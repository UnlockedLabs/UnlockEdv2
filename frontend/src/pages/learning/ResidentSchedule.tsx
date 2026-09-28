import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toZonedTime } from 'date-fns-tz';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
// react-big-calendar types are incompatible with @types/react@18 (missing `refs`)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Calendar = BigCalendar as unknown as React.ComponentType<any>;
import moment from 'moment';
import { useAuth } from '@/auth/useAuth';
import { FacilityProgramClassEvent, ServerResponseMany } from '@/types';
import { PageHeader } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ResidentEventDetailSheet } from '@/components/schedule/ResidentEventDetailSheet';
import { BRAND, BRAND_DARK } from '@/lib/brand';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
    id: number;
    title: string;
    start: Date;
    end: Date;
    resource: FacilityProgramClassEvent;
}

function CalendarEventContent({ event }: { event: CalendarEvent }) {
    return (
        <div className="h-full overflow-hidden">
            <div className="truncate text-xs font-medium leading-tight">
                {event.title}
            </div>
        </div>
    );
}

export default function ResidentSchedule() {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);

    const timezone = user?.timezone ?? 'UTC';

    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);

    const { data: eventsResp, isLoading } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>
    >(
        user
            ? `/api/student-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}`
            : null
    );

    const formattedEvents = useMemo(() => {
        const rows = eventsResp?.data ?? [];
        return rows
            .filter((event) => !event.is_cancelled)
            .map((event) => ({
                ...event,
                start: toZonedTime(new Date(event.start), timezone),
                end: toZonedTime(new Date(event.end), timezone)
            }));
    }, [eventsResp, timezone]);

    const calendarEvents: CalendarEvent[] = useMemo(
        () =>
            formattedEvents.map((event) => ({
                id: event.id,
                title: event.title,
                start: event.start,
                end: event.end,
                resource: event
            })),
        [formattedEvents]
    );

    const eventStyleGetter = () => ({
        style: {
            backgroundColor: BRAND,
            borderColor: BRAND_DARK,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '4px',
            color: 'white'
        }
    });

    if (!user) return null;

    return (
        <div className="flex h-full flex-col gap-4 p-6">
            <PageHeader title="Schedule" subtitle="Your upcoming classes" />

            {isLoading ? (
                <Skeleton className="flex-1" />
            ) : (
                <div className="unlocked-calendar min-h-0 flex-1 rounded-lg border border-gray-200 bg-white p-6">
                    <Calendar
                        localizer={localizer}
                        events={calendarEvents}
                        startAccessor="start"
                        endAccessor="end"
                        defaultView="month"
                        views={['month']}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        onSelectEvent={(event: CalendarEvent) =>
                            setSelectedEvent(event.resource)
                        }
                        eventPropGetter={eventStyleGetter}
                        style={{ height: '100%' }}
                        components={{ event: CalendarEventContent }}
                    />
                </div>
            )}

            <ResidentEventDetailSheet
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />
        </div>
    );
}
