import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import {
    Attendance,
    Class,
    SelectedClassStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import Pagination from '@/Components/Pagination';
import { useForm } from 'react-hook-form';
import { DateInput } from '@/Components/inputs/DateInput';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import {
    ClassEventInstance,
    ProgramClassEventAttendance
} from '@/types/events';
import { parseLocalDay } from '@/Components/helperFunctions/formatting';
import {
    ClipboardDocumentCheckIcon,
    EyeIcon
} from '@heroicons/react/24/outline';
import moment from 'moment';
import ULIComponent from '@/Components/ULIComponent';

function toLocalMidnight(dateOnly: string): Date {
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year, month - 1, day);
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
    const { register, watch, setValue } = useForm<{ selectedMonth: string }>({
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

    const blockEdits = isCompletedCancelledOrArchived(
        this_program ?? ({} as Class)
    );
    const meta = data?.meta;
    const events = data?.data ?? [];

    function isFutureDate(date: string): boolean {
        const day = parseLocalDay(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return day > today;
    }

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

    function getStatus(
        program_class: Class | undefined,
        event: ClassEventInstance
    ): string {
        const eventDate = toLocalMidnight(event.date).getTime();
        const today = new Date().setHours(0, 0, 0, 0);
        if (
            program_class?.status === SelectedClassStatus.Cancelled ||
            event.is_cancelled
        ) {
            return 'Cancelled';
        }
        if (eventDate > today) {
            return 'Scheduled';
        }
        const expectedCount =
            program_class?.status === SelectedClassStatus.Completed
                ? program_class.completed
                : program_class?.enrolled;
        if (event.attendance_records?.length === expectedCount) {
            return 'Marked';
        }
        return 'Unmarked';
    }

    function AttendanceAction({ event }: { event: ClassEventInstance }) {
        const isViewOnly = blockEdits || event.is_cancelled;
        const isFuture = isFutureDate(event.date);

        if (isFuture) {
            return (
                <span className="text-grey-2">
                    {`Available on ${moment(event.date).format('M/D')}`}
                </span>
            );
        }

        return (
            <div
                className="cursor-pointer flex gap-1 items-center"
                onClick={() =>
                    handleViewEditMarkAttendance(event.event_id, event.date)
                }
            >
                <ULIComponent
                    icon={isViewOnly ? EyeIcon : ClipboardDocumentCheckIcon}
                />
                <span className="hover:underline">
                    {isViewOnly ? 'View attendance' : 'Mark attendance'}
                </span>
            </div>
        );
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
                    onChange={(e: string) => {
                        setValue('selectedMonth', e);
                    }}
                />
            </div>

            {isLoading && <div>Loading...</div>}
            {data && events.length > 0 ? (
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-5">
                        <thead>
                            <tr className="grid grid-cols-5 px-4">
                                <th className="justify-self-start pl-4">
                                    Date
                                </th>
                                <th>Class Time</th>
                                <th>Attended</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr
                                    key={`${event.event_id}-${event.date}`}
                                    className="card grid-cols-5 justify-items-center p-4 !mr-0"
                                >
                                    <td className="justify-self-start pl-4">
                                        {toLocalMidnight(
                                            event.date
                                        ).toLocaleDateString('en-US', {
                                            month: '2-digit',
                                            day: '2-digit'
                                        })}
                                    </td>
                                    <td>
                                        {formatClassTime(
                                            event.date,
                                            event.class_time
                                        )}
                                    </td>
                                    <td>{`${event.attendance_records ? getPresentCount(event.attendance_records) : 0} ${
                                        enrolled ? `/ ${enrolled}` : ''
                                    }`}</td>
                                    <td>
                                        {getStatus(
                                            this_program ?? undefined,
                                            event
                                        )}
                                    </td>
                                    <td>
                                        <AttendanceAction event={event} />
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
