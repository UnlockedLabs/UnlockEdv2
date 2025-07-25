import { canSwitchFacility, isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useMemo, useState } from 'react';
import SearchBar from '@/Components/inputs/SearchBar';
import {
    ServerResponseMany,
    FilterPastTime,
    ServerResponseOne,
    ProgramsOverviewTable,
    ProgramsFacilitiesStats,
    UserRole
} from '@/common';
import useSWR, { KeyedMutator } from 'swr';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import DropdownControl from '@/Components/inputs/DropdownControl';
import StatsCard from '@/Components/StatsCard';
import ULIComponent from '@/Components/ULIComponent';
import { useDebounceValue } from 'usehooks-ts';
import {
    formatPercent,
    transformStringToArray
} from '@/Components/helperFunctions';
import { AddButton } from '@/Components/inputs';
import ProgramStatus from '@/Components/ProgramStatus';
import { useLoaderData, useNavigate } from 'react-router-dom';
import API from '@/api/api';
import { SortPillButton } from '@/Components/pill-labels/SortByPillButton';
import {
    Filter,
    FilterOptions,
    FilterOptionType,
    FilterPillButton
} from '@/Components/pill-labels/FilterByPillButton';

export function ProgramRow({
    program,
    tableColsLen,
    mutate
}: {
    program: ProgramsOverviewTable;
    tableColsLen: string;
    mutate: KeyedMutator<ServerResponseMany<ProgramsOverviewTable>>;
}) {
    const { user } = useAuth();
    const navigate = useNavigate();
    let background = '';
    if (program.archived_at !== null) background = 'bg-grey-1';
    const programTypes = transformStringToArray(program.program_types);
    const creditTypes = transformStringToArray(program.credit_types);
    const {
        total_active_facilities,
        total_enrollments,
        total_active_enrollments,
        total_classes,
        completion_rate,
        attendance_rate
    } = program;
    function TagsWithFormatting({ types }: { types: string[] | string }) {
        return typeof types === 'string' ? (
            <>{types}</>
        ) : (
            <div className="tooltip" data-tip={types.join(', ')}>
                {types[0]} (...)
            </div>
        );
    }
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
            className={`grid ${tableColsLen} justify-items-center gap-2 items-center text-center card !mr-0 px-2 py-2 ${background} cursor-pointer`}
            onClick={(e) => {
                e.stopPropagation();
                navigate(`${program.program_id}`);
            }}
        >
            <td>{program.program_name}</td>
            {user?.role != UserRole.FacilityAdmin && (
                <td>{total_active_facilities ?? <NullValue />}</td>
            )}
            <td>{total_enrollments ?? <NullValue />}</td>
            <td>{total_active_enrollments ?? <NullValue />}</td>
            <td>{total_classes ?? <NullValue />}</td>
            <td>
                {completion_rate ? (
                    formatPercent(completion_rate) + '%'
                ) : (
                    <NullValue />
                )}
            </td>
            <td>
                {attendance_rate ? (
                    formatPercent(attendance_rate) + '%'
                ) : (
                    <NullValue />
                )}
            </td>
            <td>
                <TagsWithFormatting types={programTypes} />
            </td>
            <td>
                <TagsWithFormatting types={creditTypes} />
            </td>
            <td>{transformStringToArray(program.funding_type)}</td>
            <td className="text-left">
                <ProgramStatus program={program} mutate={mutate} />
            </td>
        </tr>
    );
}

export default function ProgramManagement() {
    const { user } = useAuth();
    const { funding_types, credit_types, program_types } = useLoaderData() as {
        funding_types: string[];
        credit_types: string[];
        program_types: string[];
    };
    const { statsCols, tableColsLen } =
        user?.role === UserRole.FacilityAdmin
            ? { statsCols: 'grid-cols-4', tableColsLen: 'grid-cols-10' }
            : { statsCols: 'grid-cols-5', tableColsLen: 'grid-cols-11' };
    const tableCols = {
        Name: 'programs.name',
        ...(user?.role !== UserRole.FacilityAdmin
            ? {
                  '# of Facilities Assigned': 'mr.total_active_facilities',
                  'Total Enrollments': 'mr.total_enrollments'
              }
            : { 'Total Enrollments': 'mr.total_enrollments' }),
        'Active Enrollments': 'mr.total_active_enrollments',
        'Total Classes': 'mr.total_classes',
        'Avg. Completion Rate': 'completion_rate',
        'Avg. Attendance Rate': 'attendance_rate',
        Category: 'pt.program_types',
        'Credit Type': 'pct.credit_types',
        'Funding Type': 'programs.funding_type',
        Status: 'programs.is_active'
    };

    const filterMapping: FilterOptions[] = [
        {
            key: 'Name',
            value: 'programs.name',
            type: FilterOptionType.string,
            categories: null
        },
        ...(user?.role !== UserRole.FacilityAdmin
            ? [
                  {
                      key: '# of Facilities Assigned',
                      value: 'mr.total_active_facilities',
                      type: FilterOptionType.number,
                      categories: null
                  }
              ]
            : []),
        {
            key: 'Total Enrollments',
            value: 'mr.total_enrollments',
            type: FilterOptionType.number,
            categories: null
        },
        {
            key: 'Active Enrollments',
            value: 'mr.total_active_enrollments',
            type: FilterOptionType.number,
            categories: null
        },
        {
            key: 'Total Classes',
            value: 'mr.total_classes',
            type: FilterOptionType.number,
            categories: null
        },
        {
            key: 'Avg. Completion Rate',
            value: 'completion_rate',
            type: FilterOptionType.number,
            categories: null
        },
        {
            key: 'Avg. Attendance Rate',
            value: 'attendance_rate',
            type: FilterOptionType.number,
            categories: null
        },
        {
            key: 'Category',
            value: 'pt.program_types',
            type: FilterOptionType.category,
            categories: program_types
        },
        {
            key: 'Credit Type',
            value: 'pct.credit_types',
            type: FilterOptionType.category,
            categories: credit_types
        },
        {
            key: 'Funding Type',
            value: 'programs.funding_type',
            type: FilterOptionType.category,
            categories: funding_types
        },
        {
            key: 'Status',
            value: 'programs.is_active',
            type: FilterOptionType.category,
            categories: null
        }
    ];

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
    const [appliedSort, setAppliedSort] = useState(false);
    const [order, setOrder] = useState('');
    const [orderBy, setOrderBy] = useState('');
    const [filters, setFilters] = useState<Filter[]>([]);
    const [filterQueryString, setFilterQueryString] = useState<string>('');

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
        completion_rate,
        last_run
    } = programsFacilitiesStats?.data ?? {
        total_programs: '--',
        avg_active_programs_per_facility: '--',
        total_enrollments: '--',
        attendance_rate: '--',
        completion_rate: '--',
        last_run: null
    };

    const {
        data: programs,
        isLoading: programsLoading,
        mutate
    } = useSWR<ServerResponseMany<ProgramsOverviewTable>, Error>(
        `/api/programs/detailed-list?days=${dateRange}&page=${page}&per_page=${perPage}&search=${searchQuery[0]}&order=${order}&order_by=${orderBy}&include_archived=${includeArchived}&${filterQueryString}`
    );
    const meta = programs?.meta;

    const tableDateRangeLabel = useMemo(() => {
        if (dateRange === FilterPastTime['All time']) return 'all time';
        const startDate = new Date(
            Date.now() - parseInt(dateRange, 10) * 86400000
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
        return `${startDate} to ${endDate}`;
    }, [dateRange]);

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        setPage(1);
    }

    function formatLastRanMessage(): string {
        if (!last_run || last_run.toString() === '0001-01-01T00:00:00Z')
            return 'Not updated yet.';
        const lastRanDtTime = new Date(last_run);
        const formattedDate = lastRanDtTime.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
        const formattedTime = lastRanDtTime.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `Last updated ${formattedDate} at ${formattedTime}.`;
    }

    function downloadCSV() {
        API.downloadFile(`programs/csv?all=${canSwitchFacility(user!)}`)
            .then(({ blob, headers }) => {
                const disposition = headers.get('Content-Disposition') ?? '';
                const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
                    disposition
                );

                const filename =
                    match?.[1]?.replace(/['"]/g, '') ?? 'programs_data.csv';

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error) => {
                console.error('Error downloading CSV:', error);
            });
    }

    function orderCallback(column: string, order: string) {
        setOrder(order);
        setOrderBy(column);
    }

    function onApplyFilter(filter: Filter) {
        console.log(filter);
        setFilters((prev: Filter[]) => [...prev, filter]);
        setPage(1);
    }

    function onRemoveFilter(column: string) {
        setFilters((prev: Filter[]) => prev.filter((f) => f.column !== column));
    }

    useEffect(() => {
        const filterQueryParams = filters
            .map((f) => `filter_${f.column}=${f.value}`)
            .join('&');
        setFilterQueryString(filterQueryParams);
    }, [filters]);

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
                    number={
                        total_programs === null
                            ? '--'
                            : total_programs.toString()
                    }
                    label={'programs'}
                    tooltip={`Count of unique programs offered ${user?.role === UserRole.FacilityAdmin ? 'at ' + user.facility_name : 'across all facilities'}.`}
                    useToLocaleString={false}
                />
                {user?.role !== UserRole.FacilityAdmin && (
                    <StatsCard
                        title={'Active Programs Per Facility'}
                        number={
                            avg_active_programs_per_facility === null
                                ? '--'
                                : avg_active_programs_per_facility.toString()
                        }
                        label={'programs'}
                        tooltip="Average number of programs per facility with at least one active class and enrolled students."
                        useToLocaleString={false}
                    />
                )}
                <StatsCard
                    title={'Total Enrollments'}
                    number={
                        total_enrollments === null
                            ? '--'
                            : total_enrollments.toString()
                    }
                    label={'residents'}
                    tooltip="Total number of enrollments. A single resident may be enrolled in more than one program."
                    useToLocaleString={false}
                />
                <StatsCard
                    title={'Avg Attendance Rate'}
                    number={formatPercent(attendance_rate)}
                    label={'%'}
                    tooltip="Average attendance across all sessions where attendance was recorded."
                    useToLocaleString={false}
                />
                <StatsCard
                    title={'Avg Completion Rate'}
                    number={formatPercent(completion_rate)}
                    label={'%'}
                    tooltip="Average percentage of participants who completed a program. Only includes classes with defined end dates."
                    useToLocaleString={false}
                    tooltipClass="tooltip-left"
                />
            </div>
            <div className="flex flex-row justify-between items-center mt-4">
                <div className="flex flex-row items-center space-x-4">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
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
                    {canSwitchFacility(user!) && (
                        <AddButton
                            label="Add Program"
                            onClick={() => {
                                navigate('detail');
                            }}
                        />
                    )}
                    <AddButton
                        label="Export Program Data"
                        onClick={() => {
                            downloadCSV();
                        }}
                    />
                </div>
            </div>
            <div className="flex flex-row gap-2">
                <SortPillButton
                    columns={Object.fromEntries(
                        Object.entries(tableCols).filter(
                            ([key]) =>
                                key !== 'Category' &&
                                key !== 'Credit Type' &&
                                key !== 'Funding Type' &&
                                key !== 'Status'
                        )
                    )}
                    appliedSort={{
                        appliedSortBool: appliedSort,
                        setAppliedSort: setAppliedSort
                    }}
                    orderCallback={orderCallback}
                />
                <FilterPillButton
                    filters={filters}
                    columns={tableCols}
                    filterOptions={filterMapping}
                    onApplyFilter={onApplyFilter}
                    onRemoveFilter={onRemoveFilter}
                />
            </div>
            <div className="card px-6 pb-6 space-y-4">
                <table className="table-2">
                    <thead>
                        <tr
                            className={`grid ${tableColsLen} justify-items-center gap-2 items-center text-center px-2 !text-xs`}
                        >
                            {Object.entries(tableCols).map(([key], index) => (
                                <th
                                    key={index}
                                    className={
                                        key === 'Status'
                                            ? 'flex items-center'
                                            : ''
                                    }
                                >
                                    {key}
                                    {key === 'Status' &&
                                        user?.role ===
                                            UserRole.FacilityAdmin && (
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
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {programsLoading ? null : !programs?.data?.length ? (
                            <tr>
                                <th>
                                    <p className="body text-center text-error">
                                        No programs to show.
                                    </p>
                                </th>
                            </tr>
                        ) : (
                            programs.data.map((program, index) => (
                                <ProgramRow
                                    key={index}
                                    program={program}
                                    tableColsLen={tableColsLen}
                                    mutate={mutate}
                                />
                            ))
                        )}
                    </tbody>
                </table>
                <p className="flex justify-center body italic">
                    {`Program data in table reflects the selected date range: ${tableDateRangeLabel}`}
                    <br />
                    {formatLastRanMessage()}
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
