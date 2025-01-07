import { CurrentEnrollment, StudentDashboardJoin } from '@/common';
import convertSeconds from '../ConvertSeconds';

export default function ResidentWeeklyActivityTable({
    userData
}: {
    userData: StudentDashboardJoin;
}) {
    return (
        <div className="w-1/2 h-[254px] bg-base-teal card">
            <h2 className="mt-4 ml-4">Learning Time</h2>
            <div className="px-4">
                <table className="w-full">
                    <thead>
                        <tr className="flex flex-row justify-between border border-x-0 border-t-0 mt-2">
                            <th className="body text-grey-4">Course Name</th>
                            <th className="body text-grey-4">Time Spent</th>
                        </tr>
                    </thead>
                    <tbody className="flex flex-col gap-4 mt-4 overflow-auto h-36 scrollbar">
                        {userData.enrollments ? (
                            userData?.enrollments?.map(
                                (course: CurrentEnrollment, index: number) => {
                                    const totalTime = convertSeconds(
                                        course.total_activity_time
                                    );
                                    return (
                                        <tr
                                            className="flex flex-row justify-between mr-3"
                                            key={index}
                                        >
                                            <td className="body-small">
                                                {course.name}
                                            </td>
                                            <td className="body-small">
                                                {totalTime.number +
                                                    ' ' +
                                                    totalTime.label}
                                            </td>
                                        </tr>
                                    );
                                }
                            )
                        ) : (
                            <p className="body-small">No activity to show.</p>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
