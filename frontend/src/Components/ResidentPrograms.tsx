import {
    ServerResponseMany,
    ResidentProgramOverview,
    ProgClassStatus,
    EnrollmentStatus
} from '@/common';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import Pagination from './Pagination';
import { textMonthLocalDate } from './helperFunctions/formatting';
import { showModal, ResidentAttendanceModal } from './modals';
import { isAdministrator, useAuth } from '@/useAuth';

export default function ResidentPrograms({ user_id }: { user_id: string }) {
    const user = useAuth();
    const canViewClassDetails = isAdministrator(user.user);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const residentAttendanceModal = useRef(null);
    const [selectedClass, setSelectedClass] =
        useState<ResidentProgramOverview | null>(null);
    const navigate = useNavigate();
    const {
        data: programsResp,
        error: programsError,
        isLoading
    } = useSWR<ServerResponseMany<ResidentProgramOverview>, Error>(
        `/api/users/${user_id}/programs?page=${page}&per_page=${perPage}&order=DESC&order_by=start_dt&all=true`
    );
    const programs = programsResp?.data;
    const meta = programsResp?.meta;

    const today = new Date().toISOString().split('T')[0];
    const activePrograms = programs?.filter(
        (p) =>
            p.enrollment_status === EnrollmentStatus.Enrolled &&
            p.start_date <= today &&
            (!p.end_date || p.end_date >= today)
    );
    const scheduledPrograms = programs?.filter(
        (p) =>
            p.enrollment_status === EnrollmentStatus.Enrolled &&
            p.start_date > today
    );

    const completedPrograms = programs?.filter(
        (p) =>
            (p.status === ProgClassStatus.COMPLETED &&
                p.enrollment_status === EnrollmentStatus.Completed) ||
            (p.enrollment_status === EnrollmentStatus.Completed &&
                p.status != ProgClassStatus.CANCELLED)
    );

    const didNotCompletePrograms = programs?.filter(
        (p) =>
            p.enrollment_status === EnrollmentStatus.Dropped ||
            p.enrollment_status === EnrollmentStatus['Failed To Complete'] ||
            p.enrollment_status === EnrollmentStatus.Withdrawn ||
            p.enrollment_status === EnrollmentStatus.Cancelled ||
            p.enrollment_status === EnrollmentStatus.Transfered
    );

    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setPage(1);
    };

    const handleNavigate = (class_id: number) => {
        navigate(`/program-classes/${class_id}`);
    };

    function ProgramSectionDividerRow({ type }: { type: string }) {
        return (
            <tr className={`body bg-teal-1 !mr-0`}>
                <td colSpan={6} className="font-bold py-2">
                    {type}
                </td>
            </tr>
        );
    }

    function ResidentProgramRow({ pc }: { pc: ResidentProgramOverview }) {
        const clickableElement = `cursor-pointer hover:underline p-2`;
        return (
            <tr
                key={`${pc.class_id}-${pc.start_date}`}
                className={`grid grid-cols-6 justify-items-center !mr-0`}
            >
                <td className="justify-self-start">{pc.program_name}</td>
                <td
                    className={canViewClassDetails ? clickableElement : ''}
                    onClick={
                        canViewClassDetails
                            ? () => handleNavigate(pc.class_id)
                            : undefined
                    }
                >
                    {pc.class_name}
                </td>
                <td>{pc.enrollment_status}</td>
                <td>{textMonthLocalDate(pc.start_date)}</td>
                <td>{pc.end_date ? textMonthLocalDate(pc.end_date) : ''}</td>
                <td
                    className={`justify-self-end ${clickableElement} px-7`}
                    onClick={() => {
                        setSelectedClass(pc);
                        showModal(residentAttendanceModal);
                    }}
                >
                    {pc.attendance_percentage}
                </td>
            </tr>
        );
    }

    return (
        <div>
            <h2>Resident Programs</h2>
            {!programsResp || (isLoading && <div>Loading...</div>)}
            {programsError ? (
                <p className="body text-error">
                    Error retrieving programs for selected resident
                </p>
            ) : (
                <div className="relative w-full overflow-x-clip">
                    <table className="table-2 mb-4">
                        <thead>
                            <tr className="grid grid-cols-6 px-4">
                                <th className="justify-self-start">
                                    Program Name
                                </th>
                                <th>Class Name</th>
                                <th>Enrollment Status</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th className="justify-self-end">
                                    Attendance %
                                </th>
                            </tr>
                        </thead>
                        <tbody className="!gap-0 !mt-[0.5px]">
                            {/** Active **/}
                            {activePrograms && activePrograms.length > 0 && (
                                <>
                                    <ProgramSectionDividerRow type="Active Enrollments" />
                                    {activePrograms.map((pc) => (
                                        <ResidentProgramRow
                                            pc={pc}
                                            key={pc.class_id}
                                        />
                                    ))}
                                </>
                            )}

                            {/**Scheduled **/}
                            {scheduledPrograms &&
                                scheduledPrograms.length > 0 && (
                                    <>
                                        <ProgramSectionDividerRow type="Scheduled Enrollments" />
                                        {scheduledPrograms.map((pc) => (
                                            <ResidentProgramRow
                                                pc={pc}
                                                key={pc.class_id}
                                            />
                                        ))}
                                    </>
                                )}

                            {/** Completed **/}
                            {completedPrograms &&
                                completedPrograms.length > 0 && (
                                    <>
                                        <ProgramSectionDividerRow type="Completed Enrollments" />
                                        {completedPrograms.map((pc) => (
                                            <ResidentProgramRow
                                                pc={pc}
                                                key={pc.class_id}
                                            />
                                        ))}
                                    </>
                                )}
                            {didNotCompletePrograms &&
                                didNotCompletePrograms.length > 0 && (
                                    <>
                                        <ProgramSectionDividerRow type="Did Not Complete" />
                                        {didNotCompletePrograms.map((pc) => (
                                            <ResidentProgramRow
                                                pc={pc}
                                                key={pc.class_id}
                                            />
                                        ))}
                                    </>
                                )}
                        </tbody>
                    </table>

                    {meta && (
                        <div className="flex justify-center mt-4">
                            <Pagination
                                meta={meta}
                                setPage={setPage}
                                setPerPage={handleSetPerPage}
                            />
                        </div>
                    )}
                </div>
            )}
            <ResidentAttendanceModal
                ref={residentAttendanceModal}
                selectedClass={selectedClass}
            />
        </div>
    );
}
