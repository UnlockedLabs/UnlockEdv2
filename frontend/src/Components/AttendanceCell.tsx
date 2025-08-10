import useSWR from 'swr';
import { Attendance, ServerResponseOne } from '@/common';
import {
    ClassEventInstance,
    ProgramClassEventAttendance
} from '@/types/events';

interface AttendanceCellProps {
    event: ClassEventInstance;
    classId: string;
}

export default function AttendanceCell({
    event,
    classId
}: AttendanceCellProps) {
    const {
        data: historicalData,
        error,
        isLoading
    } = useSWR<
        ServerResponseOne<{ historical_enrollment_count: number }>,
        Error
    >(
        `/api/program-classes/${classId}/historical-enrollment?date=${event.date}`
    );

    function getPresentCount(records: ProgramClassEventAttendance[]): number {
        return records.filter(
            (record) => record.attendance_status === Attendance.Present
        ).length;
    }

    const presentCount = event.attendance_records
        ? getPresentCount(event.attendance_records)
        : 0;

    if (isLoading) {
        return <span>{presentCount} / ...</span>;
    }

    if (error) {
        console.error(
            'Error fetching historical enrollment for',
            event.date,
            ':',
            error
        );
        return <span>{presentCount} / ?</span>;
    }

    const historicalEnrollment =
        historicalData?.data?.historical_enrollment_count;

    return (
        <span>
            {presentCount}
            {historicalEnrollment !== undefined
                ? ` / ${historicalEnrollment}`
                : ' / ?'}
        </span>
    );
}
