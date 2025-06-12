import { forwardRef, useState } from 'react';
import { TextOnlyModal } from './TextOnlyModal';
import { TextModalType } from '.';
import useSWR from 'swr';
import {
    attendanceLabelMap,
    ClassEventInstance,
    ResidentProgramOverview,
    ServerResponseMany
} from '@/common';
import Pagination from '../Pagination';
import Loading from '../Loading';
import { useParams } from 'react-router-dom';
import { textMonthLocalDate } from '../helperFunctions/formatting';

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
        `/api/program-classes/${selectedClass?.class_id}/events?&page=${page}&per_page=10&order_by=created_at&order=desc&user_id=${residentId}`
    );
    const meta = attendance?.meta;
    console.log(selectedClass);
    console.log(attendance?.data);
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
                                        if (event.attendance_records != null) {
                                            const attendanceRecord =
                                                event.attendance_records[0];
                                            return (
                                                <tr
                                                    key={attendanceRecord.id}
                                                    className="grid-cols-3 text-center"
                                                >
                                                    <td className="justify-self-start">
                                                        {textMonthLocalDate(
                                                            event.date
                                                        )}
                                                    </td>
                                                    <td>
                                                        {
                                                            attendanceLabelMap[
                                                                attendanceRecord
                                                                    .attendance_status
                                                            ]
                                                        }
                                                    </td>
                                                    <td className="justify-self-end">
                                                        {attendanceRecord.note}
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            return (
                                                <tr
                                                    key={event.date}
                                                    className="grid-cols-3 text-center"
                                                >
                                                    <td className="justify-self-start">
                                                        {textMonthLocalDate(
                                                            event.date
                                                        )}
                                                    </td>
                                                    <td>
                                                        No attendance data
                                                        available yet.
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            );
                                        }
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
            onSubmit={() => void console.log('submit')}
            onClose={() => void console.log('close')}
        />
    );
});
