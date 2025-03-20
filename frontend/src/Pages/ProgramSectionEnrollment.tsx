import {
    FilterProgramSectionEnrollments,
    ServerResponseMany,
    Tab,
    // ToastState,
    User
} from '@/common';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { useEffect, useState } from 'react';
import API from '@/api/api';
import TabView from '@/Components/TabView';
import { useNavigate, Outlet, useLocation, useParams } from 'react-router-dom';
import DropdownControl from '@/Components/inputs/DropdownControl';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import { useDebounceValue } from 'usehooks-ts';
import SearchBar from '@/Components/inputs/SearchBar';
import { CancelButton, SubmitButton } from '@/Components/inputs';
import Pagination from '@/Components/Pagination';
// import { SubmitHandler } from 'react-hook-form';

interface Inputs {
    section_id: number;
    user_id: number; //should be one or an array of users
}

export default function ProgramSectionManagement() {
    const { section_id } = useParams<{ section_id: string }>();
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [perPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    // const [currentPage, setCurrentPage] = useState(1);
    // TODO: add search functionality
    // TODO: make decision on sort functionality...
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const [sortQuery] = useState<string>(
        FilterProgramSectionEnrollments['Last Name (A to Z)']
    );
    // Grab my users
    const { data, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        AxiosError
    >(
        `/api/users?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=student`
    );
    // Test my users and make sure the section_id is being pulled from the url
    const credentialed_users = data?.data ?? [];
    const meta = data?.meta;
    console.log(credentialed_users);
    console.log(section_id);
    // TODO: Remove these lines above

    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const route = useLocation();
    const tab = route.pathname.split('/')[2] ?? 'enrollment';
    const id = route.pathname.split('/')[1];
    const tabOptions: Tab[] = [
        { name: 'Dashboad', value: 'dashboard' },
        { name: 'Scheduling', value: 'scheduling' },
        { name: 'Enrollment', value: 'enrollment' },
        { name: 'Attendance', value: 'attendance' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === tab) ?? tabOptions[2]
    );

    useEffect(() => {
        setAuthLayoutPageTitle(activeTab.value as string);
    }, [activeTab]);

    const handlePageChange = (tab: Tab) => {
        if (tab.value == 'enrollment') {
            setActiveTab(tab);
            navigate(`/programs/${id}/${tab.value}`);
        }
    };

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    const allSelected =
        selectedUsers.length === credentialed_users.length &&
        credentialed_users.length > 0;

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelectedUsers(credentialed_users.map((u) => u.id));
        } else {
            setSelectedUsers([]);
        }
    }

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

        // Write logic here for checking the capacity of the section

        setErrorMessage('');

        try {
            await Promise.all(
                selectedUsers.map((user_id) => {
                    const requestData: Inputs = {
                        section_id: Number(section_id),
                        user_id: user_id
                    };

                    return API.post(
                        `section-enrollments/${section_id}/enroll/${user_id}`,
                        requestData
                    );
                })
            );

            // onSubmit('Users successfully enrolled', ToastState.success);
            setSelectedUsers([]);
            console.log('It saved i think');
            // TODO: Look at what how the handler is saving the record, there is no enrollment status.
        } catch (error) {
            console.error('Enrollment failed:', error);
            setErrorMessage('Failed to enroll users');
            // onSubmit('Failed to enroll users', ToastState.error);
        }
    };

    return (
        <div className="px-5 pb-4">
            <TabView
                tabs={tabOptions}
                activeTab={activeTab}
                setActiveTab={handlePageChange}
            />
            <div className="flex flex-col gap-8 py-8">
                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                        <SearchBar
                            searchTerm={'TEST'}
                            changeCallback={handleChange}
                        />
                        <DropdownControl
                            label="Order by"
                            // setState={setSortQuery}
                            enumType={FilterProgramSectionEnrollments}
                        />
                    </div>
                </div>
                <form
                    className="shadow-lg overflow-hidden border p-4"
                    onSubmit={(e) => {
                        void handleSubmit(e);
                    }}
                >
                    <table className="table w-full table-fixed mb-2 border">
                        <thead className="bg-gray-200 dark:text-black">
                            <tr className="">
                                <th className="h-14 pr-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox mr-1"
                                        checked={allSelected}
                                        onChange={(e) =>
                                            handleToggleAll(e.target.checked)
                                        }
                                    />
                                    <label>{'First Name'}</label>
                                </th>
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
                                                className={`cursor-pointer ${isSelected ? 'bg-gray-200' : ''}`}
                                            >
                                                <td className="pr-2">
                                                    <input
                                                        className="checkbox mr-1 text-left"
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() =>
                                                            handleToggleRow(
                                                                user.id
                                                            )
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
                                        <td className="p-2 text-gray-500">
                                            No Credentialed Residents
                                        </td>
                                    </tr>
                                )
                            ) : (
                                <tr>
                                    <td className="p-2 text-blue-500">
                                        Loading...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="flex justify-center m-2">
                        {' '}
                        {meta && (
                            <Pagination meta={meta} setPage={setPageQuery} />
                        )}
                    </div>
                    {errorMessage && (
                        <div className="text-red-500 text-sm mt-2">
                            {errorMessage}
                        </div>
                    )}

                    {/* TODO: find a solution to the button sizing*/}
                    <div className="flex justify-end m-2">
                        <CancelButton onClick={() => console.log('test me')} />
                        {/* todo: check capacity or user on add */}
                        <SubmitButton errorMessage={errorMessage} />
                    </div>
                </form>
                <div className="flex flex-col">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
