import {
    FilterProgramClassEnrollments,
    ServerResponseMany,
    User
} from '@/common';
import { useState } from 'react';
import API from '@/api/api';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import DropdownControl from '@/Components/inputs/DropdownControl';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import { useDebounceValue } from 'usehooks-ts';
import SearchBar from '@/Components/inputs/SearchBar';
import { CancelButton } from '@/Components/inputs';
import Pagination from '@/Components/Pagination';

export default function ProgramSectionEnrollment() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { class_id } = useParams<{ class_id: string }>();
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [perPage, setPerPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterProgramClassEnrollments['Last Name (A to Z)']
    );

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        AxiosError
    >(
        `/api/users?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=student&class_id=${class_id}&include=only_unenrolled`
    );

    const credentialed_users = data?.data ?? [];
    const meta = data?.meta;

    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setPageQuery(1);
    };

    const handleSearch = (newTerm: string) => {
        setSearchTerm(newTerm);
        setPageQuery(1);
    };

    function handleToggleRow(userId: number) {
        setSelectedUsers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedUsers.length === 0) {
            setErrorMessage('Please select at least one user.');
            return;
        }

        setErrorMessage('');
        await API.post(`programs/${id}/classes/${class_id}/enrollments`, {
            user_ids: selectedUsers
        });
        setSelectedUsers([]);
        navigate(`/programs/${id}`);
    };

    return (
        <div className="px-5 pb-4">
            <div className="flex flex-col gap-8 py-8">
                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={handleSearch}
                        />
                        <DropdownControl
                            label="Order by"
                            setState={setSortQuery}
                            enumType={FilterProgramClassEnrollments}
                        />
                    </div>
                </div>
                <form
                    className="overflow-hidden border p-4"
                    onSubmit={(e) => {
                        void handleSubmit(e);
                    }}
                >
                    <table className="table w-full table-fixed mb-2 shadow-lg">
                        <thead className="">
                            <tr className="text-sm">
                                <th className="h-14 pr-2">First Name</th>
                                <th className="text-left h-14">Last Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && !error ? (
                                credentialed_users.length > 0 ? (
                                    credentialed_users.map((user: User) => {
                                        const isSelected =
                                            selectedUsers.includes(user.id);
                                        return (
                                            <tr
                                                key={user.id}
                                                onClick={() =>
                                                    handleToggleRow(user.id)
                                                }
                                                className={`cursor-pointer ${isSelected ? 'bg-gray-200 text-black' : ''}`}
                                            >
                                                <td className="pr-2">
                                                    <input
                                                        className="checkbox mr-1 text-left border-teal-3"
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() =>
                                                            handleToggleRow(
                                                                user.id
                                                            )
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    />
                                                    <label>
                                                        {user.name_first}
                                                    </label>
                                                </td>
                                                <td>{user.name_last}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td className="pr-2">
                                            No eligible residents available at
                                            this facility.
                                        </td>
                                    </tr>
                                )
                            ) : (
                                <tr>
                                    <td className="pr-2 text-blue-500">
                                        Loading...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="flex justify-center m-2">
                        {' '}
                        {meta && (
                            <Pagination
                                meta={meta}
                                setPage={setPageQuery}
                                setPerPage={handleSetPerPage}
                            />
                        )}
                    </div>
                    {errorMessage && (
                        <div className="text-error text-sm mt-2">
                            {errorMessage}
                        </div>
                    )}
                    <div className="flex flex-row justify-end m-2">
                        <CancelButton
                            onClick={() => navigate(`/programs/${id}`)}
                        />
                        <input
                            className="btn btn-primary ml-2"
                            type="submit"
                            value="Submit"
                        />
                    </div>
                </form>
                <div className="flex flex-col">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
