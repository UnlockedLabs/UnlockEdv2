import { forwardRef, useState } from 'react';
import { TextOnlyModal } from './TextOnlyModal';
import { TextModalType } from '.';
import useSWR from 'swr';
import {
    attendanceLabelMap,
    ResidentProgramOverview,
    ServerResponseMany
} from '@/common';
import Pagination from '../Pagination';
import Loading from '../Loading';
import { useParams } from 'react-router-dom';
import { textMonthLocalDate } from '../helperFunctions/formatting';
import { ClassEventInstance } from '@/types/events';

export const ResidentAttendanceModal = forwardRef(function (
    { selectedClass }: { selectedClass: ResidentProgramOverview | null },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const [page, setPage] = useState(1);
    const { user_id: residentId } = useParams<{ user_id: string }>();
    const {
        data: attendance,
        error,
        isLoading
    } = useSWR<ServerResponseMany<ClassEventInstance>, Error>(
        selectedClass?.class_id
            ? `/api/program-classes/${selectedClass?.class_id}/events?&page=${page}&per_page=10&order_by=created_at&order=desc&user_id=${residentId}`
            : null
    );
    const meta = attendance?.meta;
    function AttendanceTable() {
        return (
            <>
                {error ? (
                    <p className="text-error">
                        Error loading attendance records
                    </p>
                ) : isLoading ? (
                    <Loading />
                ) : (
                    <>
                        <table className="table-2">
                            <thead>
                                <tr className="grid-cols-3 px-4">
                                    <th className="justify-self-start">Date</th>
                                    <th>Status</th>
                                    <th className="justify-self-end">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendance && attendance?.data.length > 0 ? (
                                    attendance?.data.map((event) => {
                                        const attendanceRecord =
                                            event.attendance_records?.[0];
                                        return (
                                            <tr
                                                key={
                                                    attendanceRecord
                                                        ? attendanceRecord.id
                                                        : event.date
                                                }
                                                className="grid-cols-3 text-center"
                                            >
                                                <td className="justify-self-start">
                                                    {textMonthLocalDate(
                                                        event.date
                                                    )}
                                                </td>
                                                <td>
                                                    {attendanceRecord
                                                        ? attendanceLabelMap[
                                                              attendanceRecord
                                                                  .attendance_status
                                                          ]
                                                        : 'No attendance data available yet.'}
                                                </td>
                                                <td className="justify-self-end">
                                                    {attendanceRecord
                                                        ? attendanceRecord.note
                                                        : ''}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6}>
                                            <p>No attendance records found.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {meta && <Pagination meta={meta} setPage={setPage} />}
                    </>
                )}
            </>
        );
    }
    return (
        <TextOnlyModal
            type={TextModalType.Information}
            title={`Attendance Details for ${selectedClass?.class_name}`}
            ref={ref}
            width="max-w-4xl"
            text={<AttendanceTable />}
            onSubmit={() => {}} //eslint-disable-line
            onClose={() => {}} //eslint-disable-line
        />
    );
});
