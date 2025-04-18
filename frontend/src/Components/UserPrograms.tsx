import { ServerResponseMany, UserProgramClassInfo } from '@/common';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import Pagination from './Pagination';

export default function UserPrograms({ user_id }: { user_id: string }) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const navigate = useNavigate();
    const {
        data: programsResp,
        error: programsError,
        isLoading
    } = useSWR<ServerResponseMany<UserProgramClassInfo>, Error>(
        `/api/users/${user_id}/programs?page=${page}&per_page=${perPage}}`
    );
    const programs = programsResp?.data;
    const meta = programsResp?.meta;

    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setPage(1);
    };

    const handleNavigate = (program_id: number) => {
        navigate(`/programs/${program_id}`);
    };
    return (
        <div className="card card-row-padding">
            <h2>User Programs </h2>
            {!programsResp || (isLoading && <div>Loading...</div>)}
            {programsError ? (
                <p className="body text-error">
                    Error retrieving users programs
                </p>
            ) : (
                <div className="card p-4">
                    <table className="table w-full mb-4">
                        <thead className="bg-background">
                            <tr>
                                <th>Program Name</th>
                                <th>Class Name</th>
                                <th>Status</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th className="w-[200px]">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {programs?.map((program_class) => {
                                return (
                                    <tr
                                        key={program_class.class_id}
                                        className="bg-background"
                                        onClick={() =>
                                            handleNavigate(
                                                program_class.program_id
                                            )
                                        }
                                    >
                                        <td> {program_class.program_name}</td>
                                        <td>{program_class.class_name}</td>
                                        <td>{program_class.status}</td>
                                        <td>
                                            {new Date(
                                                program_class.start_date
                                            ).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                timeZone: 'UTC'
                                            })}
                                        </td>
                                        <td>
                                            {program_class.end_date
                                                ? new Date(
                                                      program_class.end_date
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
                                        <td>
                                            {
                                                program_class.attendance_percentage
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
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
