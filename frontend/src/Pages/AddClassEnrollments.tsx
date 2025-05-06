import {
    ClassLoaderData,
    EnrollmentStatus,
    FilterResidentNames,
    ServerResponseMany,
    User
} from '@/common';
import { useState } from 'react';
import API from '@/api/api';
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import DropdownControl from '@/Components/inputs/DropdownControl';
import useSWR from 'swr';
import { useDebounceValue } from 'usehooks-ts';
import SearchBar from '@/Components/inputs/SearchBar';
import { CancelButton } from '@/Components/inputs';
import Pagination from '@/Components/Pagination';

export default function AddClassEnrollments() {
    const navigate = useNavigate();
    const { class: classInfo, redirect } = useLoaderData() as ClassLoaderData;
    const { class_id } = useParams<{ class_id: string }>();
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [perPage, setPerPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterResidentNames['Resident Name (A-Z)']
    );
    const encodedSearchQuery = encodeURIComponent(searchQuery);

    const { data, error, isLoading } = useSWR<ServerResponseMany<User>, Error>(
        `/api/users?search=${encodedSearchQuery}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=student&class_id=${class_id}&include=only_unenrolled`
    );
    if (redirect) {
        navigate(redirect);
    }
    const credentialed_users = data?.data ?? [];
    const meta = data?.meta;
    const getEnrollmentCount = (): number => {
        return (
            classInfo?.enrollments?.filter(
                (enrollment) =>
                    enrollment.enrollment_status === EnrollmentStatus.Enrolled
            ).length ?? 0
        );
    };

    const remainingCapacity =
        (classInfo?.capacity ?? 0) -
        getEnrollmentCount() -
        selectedUsers.length;

    if (remainingCapacity < 0) {
        setErrorMessage('Class is full');
        setSelectedUsers(selectedUsers.slice(0, remainingCapacity));
    }
    if (remainingCapacity > 0 && errorMessage === 'Class is full') {
        setErrorMessage('');
    }

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
    const handleSubmit = async () => {
        if (selectedUsers.length === 0) {
            setErrorMessage('Please select at least one user.');
            setTimeout(() => setErrorMessage(''), 8000);
            return;
        }

        setErrorMessage('');
        await API.post(`program-classes/${class_id}/enrollments`, {
            user_ids: selectedUsers
        });
        setSelectedUsers([]);
        navigate(`/program-classes/${class_id}/enrollments`);
    };

    const allAreSelected =
        credentialed_users.length > 0 &&
        credentialed_users.every((user) => selectedUsers.includes(user.id));
    const handleSelectAll = () => {
        setSelectedUsers(
            selectedUsers.length === credentialed_users.length
                ? []
                : credentialed_users.map((user) => user.id)
        );
    };

    return (
        <div className="px-5 pb-4">
            <div className="flex flex-col gap-8">
                <div className="grid grid-cols-5 gap-4 items-start">
                    <div className="flex flex-col gap-2">
                        <div className="text-xl font-bold">Class Name:</div>
                        <div className="pt-2 text-lg">Currently Enrolled:</div>
                        <div className="pt-2 text-lg">Remaining Capacity:</div>
                    </div>
                    <div className="flex pr-16 flex-col gap-3 items-start">
                        <span className="text-xl pl-2 font-bold text-left">
                            {classInfo?.name ?? ''}
                        </span>
                        <span className="text-left text-lg font-bold badge badge-lg">
                            {getEnrollmentCount()} / {classInfo?.capacity}
                        </span>
                        <span className="text-left text-lg font-bold badge badge-lg">
                            {remainingCapacity}
                        </span>
                    </div>
                </div>
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <DropdownControl
                        setState={setSortQuery}
                        enumType={FilterResidentNames}
                    />
                </div>
                <form
                    className="overflow-hidden border p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmit();
                    }}
                >
                    <div
                        className="w-2/3 justify-items-start"
                        style={{ overflowX: 'clip' }}
                    >
                        <table className="table-2 card p-6">
                            <thead>
                                <tr className="grid grid-cols-5 justify-items-start">
                                    <th className="justify-self-start">
                                        <div className="flex flex-col cols-span-1 gap-2">
                                            <label className="text-sm">
                                                Select All
                                            </label>
                                            <span>
                                                <input
                                                    className="checkbox"
                                                    type="checkbox"
                                                    checked={allAreSelected}
                                                    onChange={handleSelectAll}
                                                />
                                            </span>
                                        </div>
                                    </th>
                                    <th className="h-14 pr-4">Name</th>
                                    <th className="h-14 pr-4">Resident ID</th>
                                    <th className="h-14 pr-4">Username</th>
                                    <th className="h-14 pr-4" />
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
                                                    className={`card h-16 w-full grid-cols-5 justify-items-start cursor-pointer ${isSelected ? 'gray-1' : ''}`}
                                                >
                                                    <td className="pr-2 justify-self-start pl-4">
                                                        <input
                                                            className="checkbox justify-self-start"
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
                                                    </td>
                                                    <td className="text-center pr-4">
                                                        <label>
                                                            {user.name_last}
                                                            {', '}
                                                            {user.name_first}
                                                        </label>
                                                    </td>
                                                    <td className="text-center pr-4">
                                                        {user.doc_id}
                                                    </td>
                                                    <td className="text-center pr-4">
                                                        {user.username}
                                                    </td>
                                                    <td className="text-center pr-4" />
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td className="pr-2">
                                                No eligible residents available
                                                at this facility.
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
                        {errorMessage && (
                            <div className="text-error text-sm mt-2">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-4">
                        <div className="flex-col" />
                        <div className="flex-col" />
                        <div className="flex flex-row p-4 justify-self-end">
                            <CancelButton
                                onClick={() =>
                                    navigate(
                                        `/program-classes/${class_id}/enrollments`
                                    )
                                }
                            />
                            <input
                                className="btn btn-primary ml-2"
                                type="submit"
                                value="Submit"
                            />
                        </div>
                    </div>
                </form>
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
            </div>
        </div>
    );
}
