import {
    ClassLoaderData,
    EnrollmentStatus,
    FilterResidentNames,
    SelectedClassStatus,
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
import { CancelButton, SubmitButton } from '@/Components/inputs';
import Pagination from '@/Components/Pagination';
import ULIComponent from '@/Components/ULIComponent';
import {
    CheckCircleIcon,
    UserGroupIcon,
    UserPlusIcon
} from '@heroicons/react/24/outline';

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
        if (
            classInfo?.status === SelectedClassStatus.Completed ||
            classInfo?.status === SelectedClassStatus.Cancelled
        ) {
            setErrorMessage(
                'Cannot add users to a class that is completed or cancelled.'
            );
            return;
        }
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

    function ClassInfoCol({
        icon,
        label,
        amount
    }: {
        icon: React.ForwardRefExoticComponent<
            React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
                title?: string;
                titleId?: string;
            } & React.RefAttributes<SVGSVGElement>
        >;
        label: string;
        amount: number;
    }) {
        return (
            <div className="flex flex-row gap-4">
                <ULIComponent
                    icon={icon}
                    iconClassName="!h-8 !w-8"
                    tooltipClassName="flex items-center justify-center"
                />
                <div className="flex flex-col">
                    <h3>{label}</h3>
                    <p>{amount}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-5 pb-4 flex flex-col gap-8">
            <div className="card p-4 gap-2">
                <h1>{classInfo?.name}</h1>
                <div className="grid grid-cols-3">
                    <ClassInfoCol
                        icon={UserGroupIcon}
                        label="Current Enrollment"
                        amount={getEnrollmentCount()}
                    />
                    <ClassInfoCol
                        icon={CheckCircleIcon}
                        label="Maximum Capacity"
                        amount={classInfo?.capacity ?? 0}
                    />
                    <ClassInfoCol
                        icon={UserPlusIcon}
                        label="Available Spots"
                        amount={remainingCapacity}
                    />
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
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                }}
            >
                <table className="table-2 p-6">
                    <thead className="px-1">
                        <tr className="grid grid-cols-4 pb-4 px-4">
                            <th className="justify-self-start">
                                <label className="text-sm space-x-2">
                                    <input
                                        className="checkbox"
                                        type="checkbox"
                                        checked={allAreSelected}
                                        onChange={handleSelectAll}
                                    />
                                    <span>Select All</span>
                                </label>
                            </th>
                            <th className="justify-self-start">Name</th>
                            <th className="justify-self-start">Resident ID</th>
                            <th className="justify-self-start">Username</th>
                        </tr>
                    </thead>
                    <tbody className="px-1">
                        {!isLoading && !error ? (
                            credentialed_users.length > 0 ? (
                                credentialed_users.map((user: User) => {
                                    const isSelected = selectedUsers.includes(
                                        user.id
                                    );
                                    return (
                                        <tr
                                            key={user.id}
                                            onClick={() =>
                                                handleToggleRow(user.id)
                                            }
                                            className={`card w-full p-4 grid-cols-4 cursor-pointer ${isSelected ? 'gray-1' : ''}`}
                                        >
                                            <td className="justify-self-start">
                                                <input
                                                    className="checkbox"
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        handleToggleRow(user.id)
                                                    }
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                />
                                            </td>
                                            <td>
                                                {user.name_last}
                                                {', '}
                                                {user.name_first}
                                            </td>
                                            <td>{user.doc_id}</td>
                                            <td>{user.username}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td className="pr-2">
                                        No eligible residents available at this
                                        facility.
                                    </td>
                                </tr>
                            )
                        ) : (
                            <tr>
                                <td className="body">Loading...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {errorMessage && (
                    <div className="text-error text-sm mt-2">
                        {errorMessage}
                    </div>
                )}
                <div className="flex justify-center m-2">
                    {meta && (
                        <Pagination
                            meta={meta}
                            setPage={setPageQuery}
                            setPerPage={handleSetPerPage}
                        />
                    )}
                </div>
                <div className="py-4 flex flex-row justify-between items-center sticky bottom-0 border-t bg-background">
                    <div className="flex flex-row gap-2">
                        <p>
                            {selectedUsers.length} resident
                            {selectedUsers.length === 1 ? '' : 's'} selected
                        </p>
                        <span>•</span>
                        <p>
                            {remainingCapacity} spot
                            {remainingCapacity === 1 ? '' : 's'} remaining
                        </p>
                    </div>
                    <div className="flex flex-row gap-2">
                        <CancelButton
                            onClick={() =>
                                navigate(
                                    `/program-classes/${class_id}/enrollments`
                                )
                            }
                        />
                        <SubmitButton label="Enroll Residents" />
                    </div>
                </div>
            </form>
        </div>
    );
}
