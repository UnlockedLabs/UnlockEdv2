import {
    ClassLoaderData,
    FacilityProgramClassEvent,
    ServerResponseMany
} from '@/common';
import ClassEventDetailsCard from '@/Components/ClassEventDetailsCard';
import EventCalendar from '@/Components/EventCalendar';
import { useAuth } from '@/useAuth';
import { toZonedTime } from 'date-fns-tz';
import { useMemo, useState } from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

export default function Schedule() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }

    const [showAllClasses, setShowAllClasses] = useState(false);
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);

    const navigate = useNavigate();
    const clsLoader = useLoaderData() as ClassLoaderData;

    if (clsLoader?.redirect) {
        navigate(clsLoader.redirect);
    }

    const toolTip = clsLoader
        ? `This event is from another class and cannot be edited on the ${clsLoader.class?.name} schedule.`
        : '';

    const { class_id } = useParams<{ class_id?: string }>();

    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3); // 3 months ago
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year ahead
        return { startDate: start, endDate: end };
    }, []);

    const { data: eventsResp, mutate: mutateEvents } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>,
        Error
    >(
        () =>
            `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}${
                class_id && !showAllClasses ? `&class_id=${class_id}` : ''
            }`,
        { keepPreviousData: true }
    );

    const events = eventsResp?.data;

    const formattedEvents = events
        ? events.map((event) => {
              return {
                  ...event,
                  start: toZonedTime(event.start, user?.timezone),
                  end: toZonedTime(new Date(event.end), user?.timezone)
              };
          })
        : [];

    function clearSelectedEvent() {
        const selectedElement = document.querySelector<HTMLElement>(
            '.rbc-event.rbc-selected'
        );
        if (selectedElement) {
            selectedElement.classList.remove('rbc-selected');
        }
        setSelectedEvent(null);
    }

    function canUpdateEvent(): boolean {
        if (
            selectedEvent &&
            class_id &&
            selectedEvent.class_id.toString() !== class_id
        ) {
            return false;
        }
        return true;
    }

    return (
        <div className={`flex flex-col-2 gap-2${!class_id ? ' px-2' : ''}`}>
            <div className="w-3/4 card">
                <EventCalendar
                    classId={class_id}
                    events={formattedEvents}
                    view="week"
                    handleDateClick={(event) => setSelectedEvent(event)}
                />
            </div>
            <div className="w-1/4 flex flex-col gap-2">
                <ClassEventDetailsCard
                    classId={class_id}
                    event={selectedEvent}
                    mutateEvents={mutateEvents}
                    toolTip={toolTip}
                    clearSelectedEvent={clearSelectedEvent}
                    readOnly={!canUpdateEvent()}
                    showAllClasses={showAllClasses}
                    setShowAllClasses={setShowAllClasses}
                />
            </div>
        </div>
    );
}
