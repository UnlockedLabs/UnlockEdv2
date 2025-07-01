import {
    ClassLoaderData,
    FacilityProgramClassEvent,
    ServerResponseMany
} from '@/common';
import ClassEventDetailsCard from '@/Components/ClassEventDetailsCard';
import EventCalendar from '@/Components/EventCalendar';
<<<<<<< HEAD
import { fromLocalDateToTime } from '@/Components/helperFunctions';
import { CancelButton, CloseX } from '@/Components/inputs';
import {
    CancelClassEventModal,
    RescheduleClassEventModal,
    RescheduleClassEventSeriesModal,
    RestoreClassEventModal,
    showModal
} from '@/Components/modals';
import { useAuth } from '@/useAuth';
import moment from 'moment-timezone';
import { useMemo, useRef, useState } from 'react';
=======
import { useAuth } from '@/useAuth';
import { toZonedTime } from 'date-fns-tz';
import { useMemo, useState } from 'react';
>>>>>>> df576af9 (refactor: added EventCalendar and ResidentPrograms table to Resident Programs page)
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

export default function Schedule() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [showAllClasses, setShowAllClasses] = useState(false);
    const navigate = useNavigate();
    const clsLoader = useLoaderData() as ClassLoaderData;
    if (clsLoader?.redirect) {
        navigate(clsLoader.redirect);
    }
    const toolTip = clsLoader
        ? `This event is from another class and cannot be edited on the ${clsLoader.class?.name} schedule.`
        : '';

    const { class_id } = useParams<{ class_id?: string }>();
<<<<<<< HEAD
    const rescheduleClassEventSeriesModal = useRef<HTMLDialogElement>(null);
    const cancelClassEventModal = useRef<HTMLDialogElement>(null);
    const rescheduleClassEventModal = useRef<HTMLDialogElement>(null);
    const restoreClassEventModal = useRef<HTMLDialogElement>(null);
=======
>>>>>>> df576af9 (refactor: added EventCalendar and ResidentPrograms table to Resident Programs page)
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3);
        const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        return { startDate: start, endDate: end };
    }, []);
    const { data: eventsResp, mutate: mutateEvents } = useSWR<
        ServerResponseMany<FacilityProgramClassEvent>,
        Error
    >(
        `/api/admin-calendar?start_dt=${startDate.toISOString()}&end_dt=${endDate.toISOString()}${class_id && !showAllClasses ? '&class_id=' + class_id : ''}`
    );
    const events = eventsResp?.data;
    const [selectedEvent, setSelectedEvent] =
        useState<FacilityProgramClassEvent | null>(null);

<<<<<<< HEAD
    function parseEnrolledNames(enrolledResidents: string) {
        if (enrolledResidents == '') return <p>No residents enrolled</p>;
        return (
            <div>
                {enrolledResidents.split('|').map((resident, index) => {
                    const residentName = resident.split(':')[1];
                    return <p key={index}>{residentName}</p>;
                })}
            </div>
        );
    }

    function parseDateTimes(event: FacilityProgramClassEvent): Date[] {
        const timezone = user ? user?.timezone : '';
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const startMoment = moment.utc(startDate).tz(timezone);
        const endMoment = moment.utc(endDate).tz(timezone);
        if (!startMoment.isDST() && !endMoment.isDST()) {
            startMoment.add(1, 'hour');
            endMoment.add(1, 'hour');
        }
        return [startMoment.toDate(), endMoment.toDate()];
    }

=======
>>>>>>> df576af9 (refactor: added EventCalendar and ResidentPrograms table to Resident Programs page)
    const formattedEvents = events
        ? events.map((event) => {
              const [startDate, endDate] = parseDateTimes(event);
              return {
                  ...event,
                  start: startDate,
                  end: endDate
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
<<<<<<< HEAD

    function canUpdateEvent(): boolean {
        if (
            selectedEvent &&
            class_id &&
            selectedEvent.class_id.toString() != class_id
        )
            return false;
        return true;
    }

    function renderButtons() {
        const eventType = !selectedEvent?.is_override
            ? 'series'
            : selectedEvent?.is_cancelled
              ? 'canceled'
              : 'rescheduled';
        switch (eventType) {
            case 'series':
                return (
                    <>
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() => showModal(rescheduleClassEventModal)}
                            data-tip={toolTip}
                        >
                            Edit Event
                        </button>
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button-outline${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() =>
                                showModal(rescheduleClassEventSeriesModal)
                            }
                            data-tip={toolTip}
                        >
                            Edit Series
                        </button>
                        <div
                            className={`flex flex-col w-full${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            data-tip={toolTip}
                        >
                            <CancelButton
                                disabled={!canUpdateEvent()}
                                onClick={() => showModal(cancelClassEventModal)}
                            />
                        </div>
                    </>
                );
            case 'canceled':
                return (
                    <button
                        className={`button-outline${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                        onClick={() => showModal(restoreClassEventModal)}
                        data-tip={toolTip}
                    >
                        Restore Event
                    </button>
                );
            case 'rescheduled':
                return (
                    <>
                        {' '}
                        <button
                            disabled={!canUpdateEvent()}
                            className={`button${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            onClick={() => showModal(rescheduleClassEventModal)}
                            data-tip={toolTip}
                        >
                            Edit Event
                        </button>
                        <button
                            className="button-outline"
                            onClick={() => showModal(restoreClassEventModal)}
                        >
                            Restore Event
                        </button>
                        <div
                            className={`flex flex-col w-full${!canUpdateEvent() && toolTip ? ' tooltip' : ''}`}
                            data-tip={toolTip}
                        >
                            <CancelButton
                                disabled={!canUpdateEvent()}
                                onClick={() => showModal(cancelClassEventModal)}
                            />
                        </div>
                    </>
                );
            default:
                return '';
        }
    }

=======
>>>>>>> df576af9 (refactor: added EventCalendar and ResidentPrograms table to Resident Programs page)
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
                {class_id && (
                    <>
                        {' '}
                        <div>
                            <input
                                type="checkbox"
                                checked={showAllClasses}
                                className="checkbox checkbox-sm mr-2"
                                onChange={(e) => {
                                    setShowAllClasses(e.target.checked);
                                }}
                            />
                            <label className="body">Show other classes</label>
                        </div>
                    </>
                )}
                <ClassEventDetailsCard
                    classId={class_id}
                    event={selectedEvent}
                    mutateEvents={mutateEvents}
                    toolTip={toolTip}
                    clearSelectedEvent={clearSelectedEvent}
                    readOnly={false}
                />
            </div>
>>>>>>> df576af9 (refactor: added EventCalendar and ResidentPrograms table to Resident Programs page)
        </div>
    );
}
