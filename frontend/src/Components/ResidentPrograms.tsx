import {
    ServerResponseMany,
    ResidentProgramClassInfo,
    ProgClassStatus,
    EnrollmentStatus
} from '@/common';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import Pagination from './Pagination';

export default function ResidentPrograms({ user_id }: { user_id: string }) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const navigate = useNavigate();
    const {
        data: programsResp,
        error: programsError,
        isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassInfo>, Error>(
        `/api/users/${user_id}/programs?page=${page}&per_page=${perPage}&order=DESC&order_by=start_dt`
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
    return (
        <div className="card-row-padding">
            <h2>Resident Programs</h2>
            {!programsResp || (isLoading && <div>Loading...</div>)}
            {programsError ? (
                <p className="body text-error">
                    Error retrieving Programs for selected Resident
                </p>
            ) : (
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-4">
                        <thead className="">
                            <tr className=" grid grid-cols-6 px-4">
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
                        <tbody className="!gap-0">
                            {/** Active **/}
                            {activePrograms && activePrograms.length > 0 && (
                                <>
                                    <tr className="text-sm font-semibold bg-teal-1">
                                        <td
                                            colSpan={6}
                                            className="font-bold py-2"
                                        >
                                            Active Enrollments
                                        </td>
                                    </tr>
                                    {activePrograms.map((pc) => (
                                        <tr
                                            key={`${pc.class_id}-${pc.start_date}`}
                                            className="grid grid-cols-6 cursor-pointer hover:bg-base-100 justify-items-center py-2"
                                            onClick={() =>
                                                handleNavigate(pc.class_id)
                                            }
                                        >
                                            <td className="justify-self-start">
                                                {pc.program_name}
                                            </td>
                                            <td>{pc.class_name}</td>
                                            <td>{pc.enrollment_status}</td>
                                            <td>
                                                {new Date(
                                                    pc.start_date
                                                ).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    timeZone: 'UTC'
                                                })}
                                            </td>
                                            <td>
                                                {pc.end_date
                                                    ? new Date(
                                                          pc.end_date
                                                      ).toLocaleDateString(
                                                          'en-US',
                                                          {
                                                              year: 'numeric',
                                                              month: 'short',
                                                              day: 'numeric',
                                                              timeZone: 'UTC'
                                                          }
                                                      )
                                                    : ''}
                                            </td>
                                            <td className="justify-self-end px-7">
                                                {pc.attendance_percentage}
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}

                            {/**Scheduled **/}
                            {scheduledPrograms &&
                                scheduledPrograms.length > 0 && (
                                    <>
                                        <tr className="text-sm font-semibold bg-teal-1">
                                            <td
                                                colSpan={6}
                                                className="font-bold py-2"
                                            >
                                                Scheduled Enrollments
                                            </td>
                                        </tr>
                                        {scheduledPrograms.map((pc) => (
                                            <tr
                                                key={`${pc.class_id}-${pc.start_date}`}
                                                className="grid grid-cols-6 cursor-pointer hover:bg-base-100 justify-items-center py-2"
                                                onClick={() =>
                                                    handleNavigate(pc.class_id)
                                                }
                                            >
                                                <td className="justify-self-start">
                                                    {pc.program_name}
                                                </td>
                                                <td>{pc.class_name}</td>
                                                <td>{pc.enrollment_status}</td>
                                                <td>
                                                    {new Date(
                                                        pc.start_date
                                                    ).toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            timeZone: 'UTC'
                                                        }
                                                    )}
                                                </td>
                                                <td>
                                                    {pc.end_date
                                                        ? new Date(
                                                              pc.end_date
                                                          ).toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  year: 'numeric',
                                                                  month: 'short',
                                                                  day: 'numeric',
                                                                  timeZone:
                                                                      'UTC'
                                                              }
                                                          )
                                                        : ''}
                                                </td>
                                                <td className="justify-self-end px-7">
                                                    {pc.attendance_percentage}
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                )}

                            {/** Completed **/}
                            {completedPrograms &&
                                completedPrograms.length > 0 && (
                                    <>
                                        <tr className="text-sm font-semibold bg-teal-1">
                                            <td
                                                colSpan={6}
                                                className="font-bold py-2"
                                            >
                                                Completed Enrollments
                                            </td>
                                        </tr>
                                        {completedPrograms.map((pc) => (
                                            <tr
                                                key={`${pc.class_id}-${pc.start_date}`}
                                                className="grid grid-cols-6 cursor-pointer hover:bg-base-100 justify-items-center py-2"
                                                onClick={() =>
                                                    handleNavigate(pc.class_id)
                                                }
                                            >
                                                <td className="justify-self-start">
                                                    {pc.program_name}
                                                </td>
                                                <td>{pc.class_name}</td>
                                                <td>{pc.enrollment_status}</td>
                                                <td>
                                                    {new Date(
                                                        pc.start_date
                                                    ).toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            timeZone: 'UTC'
                                                        }
                                                    )}
                                                </td>
                                                <td>
                                                    {pc.end_date
                                                        ? new Date(
                                                              pc.end_date
                                                          ).toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  year: 'numeric',
                                                                  month: 'short',
                                                                  day: 'numeric',
                                                                  timeZone:
                                                                      'UTC'
                                                              }
                                                          )
                                                        : ''}
                                                </td>
                                                <td className="justify-self-end px-7">
                                                    {pc.attendance_percentage}
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            {didNotCompletePrograms &&
                                didNotCompletePrograms.length > 0 && (
                                    <>
                                        <tr className="text-sm font-semibold bg-teal-1">
                                            <td
                                                colSpan={6}
                                                className="font-bold py-2"
                                            >
                                                Did Not Complete
                                            </td>
                                        </tr>
                                        {didNotCompletePrograms.map((pc) => (
                                            <tr
                                                key={`${pc.class_id}-${pc.start_date}`}
                                                className="grid grid-cols-6 cursor-pointer hover:bg-base-100 justify-items-center py-2"
                                                onClick={() =>
                                                    handleNavigate(pc.class_id)
                                                }
                                            >
                                                <td className="justify-self-start">
                                                    {pc.program_name}
                                                </td>
                                                <td>{pc.class_name}</td>
                                                <td>{pc.enrollment_status}</td>
                                                <td>
                                                    {new Date(
                                                        pc.start_date
                                                    ).toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            timeZone: 'UTC'
                                                        }
                                                    )}
                                                </td>
                                                <td>
                                                    {pc.end_date
                                                        ? new Date(
                                                              pc.end_date
                                                          ).toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  year: 'numeric',
                                                                  month: 'short',
                                                                  day: 'numeric',
                                                                  timeZone:
                                                                      'UTC'
                                                              }
                                                          )
                                                        : ''}
                                                </td>
                                                <td className="justify-self-end px-7">
                                                    {pc.attendance_percentage}
                                                </td>
                                            </tr>
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
        </div>
    );
}
