import { Class, ServerResponseMany, User } from '@/common';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { isArchived } from './ClassStatus';

export default function UserPrograms({ string: user_id }: User) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const navigate = useNavigate();
    const { data: programsResp, error: programsError } = useSWR<
        ServerResponseMany<Class>,
        Error
    >(`/api/programs/${user_id}/classes?page=${page}&per_page=${perPage}}`);
    const user = programsResp?.data.user as User;

    return (
        <div className="card card-row-padding">
            <h2>{user?.name_last}'s Programs</h2>
            <div className="card p-4">
                <table className="table w-full mb-4">
                    <thead className="bg-background">
                        <tr>
                            <th></th>
                            <th>Class Name</th>
                            <th>Instructor Name</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th className="w-[200px]">Enrollments</th>
                            <th className="w-[150px]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClasses.map((program_class) => {
                            return (
                                <tr
                                    key={program_class.id}
                                    className={
                                        isArchived(program_class)
                                            ? 'bg-grey-1 cursor-not-allowed'
                                            : `bg-background`
                                    }
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            {isArchived(program_class) ? (
                                                <div></div>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        handleToggleRow(
                                                            program_class.id
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td> {program_class.name}</td>
                                    <td>{program_class.instructor_name}</td>
                                    <td>
                                        {new Date(
                                            program_class.start_dt
                                        ).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            timeZone: 'UTC'
                                        })}
                                    </td>
                                    <td>
                                        {program_class.end_dt
                                            ? new Date(
                                                  program_class.end_dt
                                              ).toLocaleDateString('en-US', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  timeZone: 'UTC'
                                              })
                                            : ''}
                                    </td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/*meta && (
                    <div className="flex justify-center mt-4">
                        <Pagination
                            meta={meta}
                            setPage={setPage}
                            setPerPage={handleSetPerPage}
                        />
                    </div>
                )*/}
            </div>
        </div>
    );
}
