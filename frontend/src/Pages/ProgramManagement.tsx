import { isAdministrator, useAuth } from '@/useAuth';
import { useState } from 'react';
import SearchBar from '@/Components/inputs/SearchBar';
import {
    Option,
    ServerResponseMany,
    FilterPastTime,
    ServerResponseOne,
    ProgramsOverviewTable,
    ProgramsFacilitiesStats,
    UserRole
} from '@/common';
import useSWR from 'swr';
import {
    InformationCircleIcon,
    PlusCircleIcon
} from '@heroicons/react/24/outline';
import { useLoaderData } from 'react-router-dom';
import Pagination from '@/Components/Pagination';
import { useNavigate } from 'react-router-dom';
import CategoryDropdownFilter from '@/Components/CategoryDropdownFilter';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import DropdownControl from '@/Components/inputs/DropdownControl';
import StatsCard from '@/Components/StatsCard';
import GreyPill from '@/Components/pill-labels/GreyPill';
import TealPill from '@/Components/pill-labels/TealPill';
import ULIComponent from '@/Components/ULIComponent';
import { useDebounceValue } from 'usehooks-ts';

export function ProgramRow({ program }: { program: ProgramsOverviewTable }) {
    const { user } = useAuth();
    const cols =
        user?.role === UserRole.FacilityAdmin ? 'grid-cols-10' : 'grid-cols-11';
    const navigate = useNavigate();
    let background = '';
    if (program.archived_at !== null) background = 'bg-grey-1';
    const programTypes = program.program_types
        .replace(/_/g, ' ')
        .split(',')
        .map((s) => s.trim());
    const creditTypes = program.credit_types
        .replace(/_/g, ' ')
        .split(',')
        .map((s) => s.trim());
    const {
        total_active_facilities,
        total_enrollments,
        total_active_enrollments,
        total_classes,
        completion_rate,
        attendance_rate
    } = program;

    function NullValue() {
        return (
            <div
                className="tooltip"
                data-tip={
                    'Data currently unavailable. Please check back in 24 hours for updated statistics.'
                }
            >
                --
            </div>
        );
    }
    return (
        <tr
            className={`grid ${cols} justify-items-center gap-2 items-center text-center card !mr-0 px-2 py-2 ${background} cursor-pointer`}
            onClick={() => navigate(`${program.program_id}`)}
        >
            <td>{program.program_name}</td>
            {user?.role != UserRole.FacilityAdmin && (
                <td>{total_active_facilities ?? <NullValue />}</td>
            )}
            <td>{total_enrollments ?? <NullValue />}</td>
            <td>{total_active_enrollments ?? <NullValue />}</td>
            <td>{total_classes ?? <NullValue />}</td>
            <td>
                {completion_rate
                    ? parseFloat(completion_rate.toFixed(2)) + '%'
                    : completion_rate ?? <NullValue />}
            </td>
            <td>
                {attendance_rate
                    ? parseFloat(attendance_rate.toFixed(2)) + '%'
                    : attendance_rate ?? <NullValue />}
            </td>
            <td>
                {programTypes.length > 1 ? (
                    <div className="tooltip" data-tip={programTypes.join(', ')}>
                        {programTypes[0]} (...)
                    </div>
                ) : (
                    programTypes[0]
                )}
            </td>
            <td>
                {creditTypes.length > 1 ? (
                    <div className="tooltip" data-tip={creditTypes.join(', ')}>
                        {creditTypes[0]} (...)
                    </div>
                ) : (
                    creditTypes[0]
                )}
            </td>
            <td>{program.funding_type.replace(/_/g, ' ')}</td>
            <td>
                {program.status ? (
                    <TealPill children={'Active'} />
                ) : (
                    <GreyPill children={'Inactive'} />
                )}
            </td>
        </tr>
    );
}

export default function ProgramManagement() {
    const { user } = useAuth();
    const { statsCols, tableCols } =
        user?.role === UserRole.FacilityAdmin
            ? { statsCols: 'grid-cols-4', tableCols: 'grid-cols-10' }
            : { statsCols: 'grid-cols-5', tableCols: 'grid-cols-11' };
    if (!isAdministrator(user)) {
        return;
    }
    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const [dateRange, setDateRange] = useState<FilterPastTime>(
        FilterPastTime['Past 30 days']
    );
    const { page, perPage, setPage, setPerPage } = useUrlPagination(1, 10);
    const [includeArchived, setIncludeArchived] = useState<boolean>(false);

    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const navigate = useNavigate();

    const { data: programsFacilitiesStats } = useSWR<
        ServerResponseOne<ProgramsFacilitiesStats>,
        Error
    >(`/api/programs/stats?days=${dateRange}`);

    const {
        total_programs,
        avg_active_programs_per_facility,
        total_enrollments,
        attendance_rate,
        completion_rate
    } = programsFacilitiesStats?.data ?? {
        total_programs: '--',
        avg_active_programs_per_facility: '--',
        total_enrollments: '--',
        attendance_rate: '--',
        completion_rate: '--'
    };

    const {
        data: programs,
        isLoading: programsLoading,
        mutate
    } = useSWR<ServerResponseMany<ProgramsOverviewTable>, Error>(
        `/api/programs/detailed-list?days=${dateRange}&page=${page}&per_page=${perPage}&search=${searchQuery[0]}&${categoryQueryString}&order=asc&order_by=name&include_archived=${includeArchived}`
    );
    const meta = programs?.meta;

    const { categories } = useLoaderData() as {
        categories: Option[];
    };

    function getTableDates() {
        if (dateRange == FilterPastTime['All time']) return 'all time';
        const startDate = new Date(
            new Date().setDate(new Date().getDate() - parseInt(dateRange, 10))
        ).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const endDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        return startDate + ' to ' + endDate;
    }

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        setPage(1);
    }

    return (
        <div className="px-5 py-4 flex flex-col gap-4 overflow-x-hidden">
            <div className="flex flex-row justify-end">
                <DropdownControl
                    enumType={FilterPastTime}
                    setState={setDateRange}
                />
            </div>
            <div className={`grid ${statsCols} gap-4`}>
                <StatsCard
                    title={'Total Programs'}
                    number={total_programs.toString()}
                    label={'programs'}
                    tooltip="Count of unique programs offered across all facilities."
                    useToLocaleString={false}
                />
                {user?.role !== UserRole.FacilityAdmin && (
                    <StatsCard
                        title={'Active Programs Per Facility'}
                        number={avg_active_programs_per_facility.toString()}
                        label={'programs'}
                        tooltip="Average number of programs per facility with at least one active class and enrolled students."
                        useToLocaleString={false}
                    />
                )}
                <StatsCard
                    title={'Total Enrollments'}
                    number={total_enrollments.toString()}
                    label={'residents'}
                    tooltip="Total number of enrollments. A single resident may be enrolled in more than one program."
                    useToLocaleString={false}
                />
                <StatsCard
                    title={'Avg Attendance Rate'}
                    number={
                        typeof attendance_rate === 'string'
                            ? attendance_rate
                            : (
                                  Math.round(
                                      attendance_rate * 100 + Number.EPSILON
                                  ) / 100
                              ).toString()
                    }
                    label={'%'}
                    tooltip="Average attendance across all sessions where attendance was recorded."
                    useToLocaleString={false}
                />
                <StatsCard
                    title={'Avg Completion Rate'}
                    number={
                        typeof completion_rate === 'string'
                            ? completion_rate
                            : (
                                  Math.round(
                                      completion_rate * 100 + Number.EPSILON
                                  ) / 100
                              ).toString()
                    }
                    label={'%'}
                    tooltip="Average percentage of participants who completed a program. Only includes classes with defined end dates."
                    useToLocaleString={false}
                    tooltipClass="tooltip-left"
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
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm mr-2"
                            onChange={(e) => {
                                setIncludeArchived(e.target.checked);
                            }}
                        />
                        <span className="text-sm">
                            Include Archived Programs
                        </span>
                    </div>
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
            <div className="card px-6 pb-6 space-y-4">
                <table className="table-2">
                    <thead>
                        <tr
                            className={`grid ${tableCols} justify-items-center gap-2 items-center text-center px-2 !text-xs`}
                        >
                            <th>Name</th>
                            {user?.role != UserRole.FacilityAdmin && (
                                <th># of Facilities Assigned</th>
                            )}
                            <th>Total Enrollments</th>
                            <th>Active Enrollments</th>
                            <th># of Classes</th>
                            <th>Avg. Completion Rate</th>
                            <th>Avg. Attendance Rate</th>
                            <th>Category</th>
                            <th>Credit Type</th>
                            <th>Funding Type</th>
                            <th className="flex items-center">
                                Status
                                {user?.role === UserRole.FacilityAdmin && (
                                    <ULIComponent
                                        icon={InformationCircleIcon}
                                        dataTip={
                                            'This status reflects whether the program is currently available for scheduling new classes. Inactive programs may still have active classes running if they were scheduled before deactivation.'
                                        }
                                        tooltipClassName="tooltip-left"
                                        iconClassName="text-teal-4 cursor-help"
                                    />
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {programs?.data === undefined ||
                        programs.data === null ? (
                            <tr>
                                <th>
                                    <p className="body text-center text-error">
                                        {programsLoading
                                            ? ''
                                            : 'No programs to show.'}
                                    </p>
                                </th>
                            </tr>
                        ) : (
                            programs?.data?.map(
                                (program: ProgramsOverviewTable, index) => (
                                    <ProgramRow key={index} program={program} />
                                )
                            )
                        )}
                    </tbody>
                </table>
                <p className="flex justify-center body italic">
                    {`Program data in table reflects the selected date range: ${getTableDates()}`}
                </p>
                {meta && (
                    <div className="flex justify-center">
                        <Pagination
                            meta={meta}
                            setPage={setPage}
                            setPerPage={setPerPage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
