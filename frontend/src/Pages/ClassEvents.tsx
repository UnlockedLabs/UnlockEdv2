import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import {
    Class,
    SelectedClassStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import Pagination from '@/Components/Pagination';
import { useForm, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import { ClassEventInstance } from '@/types/events';
import AttendanceCell from '@/Components/AttendanceCell';
import { parseLocalDay } from '@/Components/helperFunctions/formatting';
import {
    ClipboardDocumentCheckIcon,
    EyeIcon
} from '@heroicons/react/24/outline';
import moment from 'moment';
import ULIComponent from '@/Components/ULIComponent';
import React, { useState } from 'react';

interface FormData {
    selectedMonth: string;
    simpleCalendarDate: string;
}

interface SimpleCalendarProps {
    setValue: UseFormSetValue<FormData>;
    register: UseFormRegister<FormData>;
}

const SimpleCalendar: React.FC<SimpleCalendarProps> = ({
    setValue,
    register
}) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Get register function and separate onChange handling (like DateInput)
    const registerProps = register('simpleCalendarDate');

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSelectedDate(new Date(value));

        // Call react-hook-form's onChange first to update form state
        void registerProps.onChange(e);

        // Convert full date to month format (YYYY-MM) to match DateInput behavior
        const monthValue = value.substring(0, 7);
        setValue('selectedMonth', monthValue);
    };

    const displayValue = selectedDate
        ? selectedDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long'
          })
        : 'Select Month';

    return (
        <div className="form-control w-full max-w-xs">
            <label className="label">
                <span className="label-text">Select Month</span>
            </label>
            <div className="relative">
                {/* Native date input for functionality */}
                <input
                    type="date"
                    className="input input-bordered w-full max-w-xs opacity-0 absolute inset-0 cursor-pointer z-10"
                    {...registerProps}
                    onChange={handleDateChange}
                />
                {/* Styled display overlay */}
                <div className="input input-bordered w-full max-w-xs flex items-center justify-between bg-white pointer-events-none">
                    <span className="text-gray-900">{displayValue}</span>
                    <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};
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
    const { register, watch, setValue } = useForm<FormData>({
        defaultValues: {
            selectedMonth: defaultMonth,
            simpleCalendarDate: ''
        }
    });
    const selectedMonthValue = watch('selectedMonth');

    const [year, month] = selectedMonthValue.split('-');

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<ClassEventInstance>,
        Error
    >(
        `/api/program-classes/${class_id}/events?month=${month}&year=${year}&page=${pageQuery}&per_page=${perPage}`
    );

    const events = data?.data ?? [];
    const eventDates = events.map((event) => event.date);

    const { data: historicalResponse } = useSWR<
        { data: Record<string, number> },
        Error
    >(
        eventDates.length > 0
            ? `/api/program-classes/${class_id}/historical-enrollment-batch?dates=${eventDates.join(',')}`
            : null
    );

    const historicalData = historicalResponse?.data;

    const { data: program_class } = useSWR<ServerResponseOne<Class>, Error>(
        `/api/program-classes/${class_id}`
    );

    const this_program = program_class?.data;

    const blockEdits = isCompletedCancelledOrArchived(
        this_program ?? ({} as Class)
    );
    const meta = data?.meta;

    function isFutureDate(date: string): boolean {
        const day = parseLocalDay(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return day > today;
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
                <SimpleCalendar setValue={setValue} register={register} />
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
                                <th>Present / Enrolled</th>
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
                                    <td>
                                        <AttendanceCell
                                            event={event}
                                            historicalEnrollment={
                                                historicalData?.[event.date]
                                            }
                                        />
                                    </td>
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
