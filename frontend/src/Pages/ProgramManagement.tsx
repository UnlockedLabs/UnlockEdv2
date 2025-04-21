import { isAdministrator, useAuth } from '@/useAuth';
import { useState } from 'react';
import SearchBar from '@/Components/inputs/SearchBar';
import {
    Program,
    Option,
    ServerResponseMany,
    FilterPastTime,
    FundingType,
    CreditType,
    ProgramType
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

const temp_programs: ProgramRow[] = [
    {
        id: 1,
        name: 'Algebra 101',
        total_facilities: 5,
        total_enrollments: 100,
        active_enrollments: 50,
        total_classes: 10,
        avg_completion_rate: 80,
        avg_attendance_rate: 90,
        program_type: ProgramType.EDUCATIONAL,
        funding_type: FundingType.FEDERAL_GRANTS,
        credit_type: CreditType.EDUCATION,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        description: '',
        tags: [],
        is_favorited: false,
        facilities: []
    },
    {
        id: 2,
        name: 'English Composition',
        total_facilities: 3,
        facilities: [],
        total_enrollments: 50,
        active_enrollments: 20,
        total_classes: 5,
        avg_completion_rate: 70,
        avg_attendance_rate: 80,
        program_type: ProgramType.EDUCATIONAL,
        funding_type: FundingType.STATE_GRANTS,
        credit_type: CreditType.EDUCATION,
        is_active: false,
        description: '',
        tags: [],
        is_favorited: false,
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        id: 3,
        name: 'Computer Programming',
        total_facilities: 2,
        facilities: [],
        total_enrollments: 20,
        active_enrollments: 10,
        total_classes: 3,
        avg_completion_rate: 90,
        avg_attendance_rate: 95,
        program_type: ProgramType.EDUCATIONAL,
        funding_type: FundingType.NON_PROFIT_ORGANIZATION,
        credit_type: CreditType.EARNED_TIME,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        description: '',
        tags: [],
        is_favorited: false
    }
];

export function ProgramRow({ program }: { program: ProgramRow }) {
    const fundingTypeText = program.funding_type.replace(/_/g, ' ');
    return (
        <tr className="grid grid-cols-11 justify-items-center gap-2 items-center text-center card !mr-0 px-2 py-1">
            <td>{program.name}</td>
            <td>{program.total_facilities}</td>
            <td>{program.total_enrollments}</td>
            <td>{program.active_enrollments}</td>
            <td>{program.total_classes}</td>
            <td>{program.avg_completion_rate}</td>
            <td>{program.avg_attendance_rate}</td>
            <td>
                <GreyPill>{program.program_type}</GreyPill>
            </td>
            <td>
                <GreyPill>{program.credit_type}</GreyPill>
            </td>
            <td>
                <GreyPill>{fundingTypeText}</GreyPill>
            </td>
            <td>
                {program.is_active ? (
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
    const { data, error, mutate } = useSWR<ServerResponseMany<Program>, Error>(
        `/api/programs?page=${page}&per_page=${perPage}&search=${searchTerm}&${categoryQueryString}&order=asc&order_by=name`
    );
    const programData = data?.data;
    const meta = data?.meta;

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
                    number={''}
                    label={'programs'}
                    tooltip="Count of unique programs offered across all facilities."
                />
                <StatsCard
                    title={'Avg Active Programs per Facility'}
                    number={''}
                    label={'programs'}
                    tooltip="Average number of programs per facility with at least one active class and enrolled students."
                />
                <StatsCard
                    title={'Total Enrollments'}
                    number={''}
                    label={'residents'}
                    tooltip="Total number of enrollments. A single resident may be enrolled in more than one program."
                />
                <StatsCard
                    title={'Avg Attendance Rate'}
                    number={''}
                    label={'%'}
                    tooltip="Average attendance across all sessions where attendance was recorded."
                />
                <StatsCard
                    title={'Avg Completion Rate'}
                    number={''}
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
                    {temp_programs?.map((program) => (
                        <ProgramRow program={program} />
                    ))}
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
