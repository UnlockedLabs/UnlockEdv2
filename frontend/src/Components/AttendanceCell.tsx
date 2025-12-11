import { Attendance } from '@/common';
import {
    ClassEventInstance,
    ProgramClassEventAttendance
} from '@/types/events';

interface AttendanceCellProps {
    event: ClassEventInstance;
    historicalEnrollment?: number;
}

export default function AttendanceCell({
    event,
    historicalEnrollment
}: AttendanceCellProps) {
    function getPresentCount(records: ProgramClassEventAttendance[]): number {
        return records.filter(
            (record) =>
                record.attendance_status === Attendance.Present ||
                record.attendance_status === Attendance.Partial
        ).length;
    }

    const presentCount = event.attendance_records
        ? getPresentCount(event.attendance_records)
        : 0;

    return (
        <span>
            {presentCount}
            {historicalEnrollment !== undefined
                ? ` / ${historicalEnrollment}`
                : ' / ...'}
        </span>
    );
}
