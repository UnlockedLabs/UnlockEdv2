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
import { useForm } from 'react-hook-form';
import { DateInput } from '@/Components/inputs/DateInput';

function toLocalMidnight(dateOnly: string): Date {
    const [y, m, d] = dateOnly.split('-').map(Number);
    return new Date(y, m - 1, d); // safe in every browser
}

export default function ClassEvents() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const defaultMonth = new Date().toISOString().substring(0, 7);
    const { register, watch } = useForm<{ selectedMonth: string }>({
        defaultValues: { selectedMonth: defaultMonth }
    });
    const selectedMonthValue = watch('selectedMonth');

    const [year, month] = selectedMonthValue.split('-');

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<ClassEventInstance>,
        Error
    >(
        `/api/program-classes/${class_id}/events?month=${month}&year=${year}&page=${pageQuery}&per_page=${perPage}`
    );

    const { data: program_class } = useSWR<ServerResponseOne<Class>, Error>(
        `/api/program-classes/${class_id}`
    );

    const this_program = program_class?.data;
    const enrolled = this_program?.enrolled;
    const meta = data?.meta;
    const events = data?.data ?? [];

    function getPresentCount(records: ProgramClassEventAttendance[]): number {
        return records.filter(
            (record) => record.attendance_status === Attendance.Present
        ).length;
    }

    function handleViewEditMarkAttendance(eventId: number, date: string) {
        navigate(
            `/program-classes/${class_id}/events/${eventId}/attendance/${date}`
        );
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
        const eventDate = toLocalMidnight(event.date).getTime();
        //const eventDate = new Date(event.date).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);
        return eventDate > today
            ? 'Scheduled'
            : event.attendance_records?.length === enrolled
              ? 'Marked'
              : 'Not Marked';
    }

    return (
        <div>
            <div className="flex mb-4 justify-start">
                <DateInput
                    label="Select Month"
                    interfaceRef="selectedMonth"
                    required={true}
                    errors={{}}
                    register={register}
                    monthOnly={true}
                    disabled={false}
                />
            </div>

            {isLoading && <div>Loading...</div>}
            {data && events.length > 0 ? (
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-5">
                        <thead>
                            <tr className="grid grid-cols-5 px-4">
                                <th className="justify-self-start">Date</th>
                                <th>Class Time</th>
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
                                        {toLocalMidnight(
                                            event.date
                                        ).toLocaleDateString('en-US', {
                                            month: '2-digit',
                                            day: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-4">
                                        {formatClassTime(
                                            event.date,
                                            event.class_time
                                        )}
                                    </td>
                                    <td className="px-5">{`${event.attendance_records ? getPresentCount(event.attendance_records) : 0} ${
                                        enrolled ? `/ ${enrolled}` : ''
                                    }`}</td>
                                    <td className="px-5">{getStatus(event)}</td>
                                    <td className="justify-self-end">
                                        {event.attendance_records?.length >
                                        0 ? (
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
                error && (
                    <div className="text-error">
                        No events found for this month.
                    </div>
                )
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
