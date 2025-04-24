import { isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useState } from 'react';
import SearchBar from '@/Components/inputs/SearchBar';
import {
    Program,
    Option,
    ServerResponseMany,
    FilterPastTime,
    ServerResponseOne,
    ProgramsOverview,
    ProgramsOverviewTable
} from '@/common';
import useSWR from 'swr';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useLoaderData } from 'react-router-dom';
import Pagination from '@/Components/Pagination';
import { useNavigate } from 'react-router-dom';
import CategoryDropdownFilter from '@/Components/CategoryDropdownFilter';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import DropdownControl from '@/Components/inputs/DropdownControl';
import StatsCard from '@/Components/StatsCard';
import GreyPill from '@/Components/pill-labels/GreyPill';
import TealPill from '@/Components/pill-labels/TealPill';

export interface ProgramRow extends Program {
    total_facilities: number;
    total_enrollments: number;
    active_enrollments: number;
    total_classes: number;
    avg_completion_rate: number;
    avg_attendance_rate: number;
}

export function ProgramRow({ program }: { program: ProgramsOverviewTable }) {
    return (
        <tr className="grid grid-cols-11 justify-items-center gap-2 items-center text-center card !mr-0 px-2 py-2">
            <td>{program.program_name}</td>
            <td>{program.num_facilities_available}</td>
            <td>{program.total_enrollments}</td>
            <td>{program.active_enrollments}</td>
            <td>{program.total_classes}</td>
            <td>{parseFloat(program.completion_rate.toFixed(2))}%</td>
            <td>{parseFloat(program.attendance_rate.toFixed(2))}%</td>
            <td>
                {program.program_types.replace(/,/g, ', ').replace(/_/g, ' ')}
            </td>
            <td>{program.credit_types.replace(/,/g, ', ')}</td>
            <td>{program.funding_type.replace(/_/g, ' ')}</td>
            <td>
                {program.status ? (
                    <TealPill children={'Active'} />
                ) : (
                    <GreyPill children={'Archived'} />
                )}
            </td>
        </tr>
    );
}

export default function ProgramManagement() {
    const { user } = useAuth();
    if (!isAdministrator(user)) {
        return;
    }
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<FilterPastTime>(
        FilterPastTime['Past 30 days']
    );
    const {
        page: page,
        perPage,
        setPage: setPage,
        setPerPage
    } = useUrlPagination(1, 20);
    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const navigate = useNavigate();
    const { data, mutate } = useSWR<ServerResponseMany<Program>, Error>(
        `/api/programs?page=${page}&per_page=${perPage}&search=${searchTerm}&${categoryQueryString}&order=asc&order_by=name`
    );

    const meta = data?.meta;
    const { data: programsOverview } = useSWR<
        ServerResponseOne<ProgramsOverview>,
        Error
    >(`/api/programs-overview?time_filter=${dateRange}`);
    const programData = programsOverview?.data;
    const {
        total_programs,
        avg_active_programs_per_facility,
        total_enrollments,
        attendance_rate,
        completion_rate
    } = programData?.programs_facilities_stats ?? {};

    useEffect(() => {
        console.log(programsOverview?.data.programs_table);
    }, [programsOverview]);

    const { categories } = useLoaderData() as {
        categories: Option[];
    };

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        setPage(1);
    }

    return (
        <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex flex-row justify-end">
                <DropdownControl
                    enumType={FilterPastTime}
                    setState={setDateRange}
                />
            </div>
            <div className="grid grid-cols-5 gap-4">
                <StatsCard
                    title={'Total Programs'}
                    number={total_programs?.toString() ?? ''}
                    label={'programs'}
                    tooltip="Count of unique programs offered across all facilities."
                />
                <StatsCard
                    title={'Avg Active Programs per Facility'}
                    number={avg_active_programs_per_facility?.toString() ?? ''}
                    label={'programs'}
                    tooltip="Average number of programs per facility with at least one active class and enrolled students."
                />
                <StatsCard
                    title={'Total Enrollments'}
                    number={total_enrollments?.toString() ?? ''}
                    label={'residents'}
                    tooltip="Total number of enrollments. A single resident may be enrolled in more than one program."
                />
                <StatsCard
                    title={'Avg Attendance Rate'}
                    number={attendance_rate?.toString() ?? ''}
                    label={'%'}
                    tooltip="Average attendance across all sessions where attendance was recorded."
                />
                <StatsCard
                    title={'Avg Completion Rate'}
                    number={completion_rate?.toString() ?? ''}
                    label={'%'}
                    tooltip="Average percentage of participants who completed a program. Only includes classes with defined end dates."
                />
            </div>
            <div className="flex flex-row justify-between items-center my-4">
                <div className="flex flex-row items-center space-x-4">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <CategoryDropdownFilter
                        mutate={() => void mutate()}
                        setCategoryQueryString={setCategoryQueryString}
                        options={categories ?? []}
                    />
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        className="button flex items-center space-x-2"
                        onClick={() => {
                            navigate('detail');
                        }}
                    >
                        <PlusCircleIcon className="w-4 my-auto" />
                        <span>Add Program</span>
                    </button>
                </div>
            </div>
            <table className="table-2 card px-6 pb-6">
                <thead>
                    <tr className="grid grid-cols-11 justify-items-center gap-2 items-center text-center px-2 !text-xs">
                        <th>Name</th>
                        <th># of Facilities Assigned</th>
                        <th>Total Enrollments</th>
                        <th>Active Enrollments</th>
                        <th># of Classes</th>
                        <th>Avg. Completion Rate</th>
                        <th>Avg. Attendance Rate</th>
                        <th>Category</th>
                        <th>Credit Type</th>
                        <th>Funding Type</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {programData?.programs_table !== undefined ? (
                        programData?.programs_table.map(
                            (program: ProgramsOverviewTable) => (
                                <ProgramRow program={program} />
                            )
                        )
                    ) : (
                        <p className="body-small text-error">
                            No programs to show.
                        </p>
                    )}
                </tbody>
            </table>
            {meta && (
                <div className="flex justify-center mt-4">
                    <Pagination
                        meta={meta}
                        setPage={setPage}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </div>
    );
}
