import { ServerResponseMany } from '@/common';
import EventCalendar from '@/Components/EventCalendar';
import ResidentPrograms from '@/Components/ResidentPrograms';
import { useAuth } from '@/useAuth';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toZonedTime } from 'date-fns-tz';
import ClassEventDetailsCard from '@/Components/ClassEventDetailsCard';
import { FacilityProgramClassEvent } from '@/types/events';

export default function ResidentOverview() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const user_id = user?.id;
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);
    const { data: eventsResp, mutate: mutateEvents } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>,
        Error
    >(
        `/api/student-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}`
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
            <div className={`flex flex-col-2 gap-2`}>
                <div className="w-3/4 card">
                    <EventCalendar
                        events={formattedEvents}
                        view="week"
                        handleDateClick={(event) => setSelectedEvent(event)}
                    />
                </div>
                <div className="w-1/4 flex flex-col gap-2">
                    <ClassEventDetailsCard
                        event={selectedEvent}
                        mutateEvents={mutateEvents}
                        toolTip=""
                        clearSelectedEvent={clearSelectedEvent}
                        readOnly
                    />
                </div>
            </div>
            <div className="card card-row-padding col-span-2 w-full mt-4">
                <ResidentPrograms user_id={user_id?.toString() ?? ''} />
            </div>
        </div>
    );
}
