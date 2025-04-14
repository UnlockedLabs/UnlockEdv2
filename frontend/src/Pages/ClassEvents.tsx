import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import {
    Attendance,
    Class,
    ClassEventInstance,
    ProgramClassEventAttendance,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import Pagination from '@/Components/Pagination';

export default function ClassAttendance() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<ClassEventInstance>,
        Error
    >(
        `/api/program-classes/class/${class_id}/events?page=${pageQuery}&per_page=${perPage}`
    );

    const { data: program_class } = useSWR<ServerResponseOne<Class>, Error>(
        `/api/program-classes/${class_id}`
    );

    const this_program = program_class?.data;
    const enrolled = this_program?.enrolled;
    const capacity = this_program?.capacity;
    const meta = data?.meta;
    const events = data?.data ?? [];
    function getPresentCount(records: ProgramClassEventAttendance[]): number {
        return records.filter(
            (record) => record.attendance_status === Attendance.Present
        ).length;
    }

    function handleViewEditMarkAttendance(eventId: number, date: string) {
        navigate(`${eventId}/attendance/${date}`);
    }

    function formatClassTime(dateStr: string, timeRange: string): string {
        const [startTime, endTime] = timeRange.split('-');
        const startDateTime = new Date(`${dateStr}T${startTime}:00`);
        const endDateTime = new Date(`${dateStr}T${endTime}:00`);
        const options = {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        } as Intl.DateTimeFormatOptions;
        return `${startDateTime.toLocaleTimeString([], options)} – ${endDateTime.toLocaleTimeString([], options)}`;
    }

    function getStatus(event: ClassEventInstance): string {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate > today) {
            return 'Scheduled';
        } else {
            if (
                enrolled !== undefined &&
                event.attendance_records.length === enrolled
            ) {
                return 'Marked';
            } else {
                return 'Not Marked';
            }
        }
    }

    return (
        <div className="p-4">
            {isLoading && <div>Loading...</div>}
            {error && <div className="error">Error loading data</div>}
            {data && events.length > 0 ? (
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-5">
                        <thead>
                            <tr className="grid grid-cols-5 px-4">
                                <th className="justify-self-start">Date</th>
                                <th className="">Class Time</th>
                                <th>Attended</th>
                                <th>Status</th>
                                <th className="justify-self-end pr-5">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr
                                    key={`${event.event_id}-${event.date}`}
                                    className="card grid-cols-5 justify-items-center"
                                >
                                    <td className="justify-self-start px-4">
                                        {new Date(
                                            event.date
                                        ).toLocaleDateString()}
                                    </td>
                                    <td className="px-4">
                                        {formatClassTime(
                                            event.date,
                                            event.class_time
                                        )}
                                    </td>
                                    <td className="px-5">{`${getPresentCount(event.attendance_records)} ${capacity ? `/ ${enrolled}` : ''}`}</td>
                                    <td className="px-5">{getStatus(event)}</td>
                                    <td className="justify-self-end">
                                        {event.attendance_records.length > 0 ? (
                                            <button
                                                onClick={() =>
                                                    handleViewEditMarkAttendance(
                                                        event.event_id,
                                                        event.date
                                                    )
                                                }
                                                className="button"
                                            >
                                                View / Edit
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    handleViewEditMarkAttendance(
                                                        event.event_id,
                                                        event.date
                                                    )
                                                }
                                                className="button"
                                            >
                                                Mark Attendance
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div></div>
            )}
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </div>
    );
}
