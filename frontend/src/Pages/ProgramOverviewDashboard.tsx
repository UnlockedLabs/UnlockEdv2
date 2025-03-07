import { useParams } from 'react-router-dom';
import { useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { Program, ServerResponseOne } from '@/common';
import { AxiosError } from 'axios';
import Error from '@/Pages/Error';
import ProgramOutcomes from '@/Components/ProgramOutcomes';
import ProgressBar from '@/Components/ProgressBar';
import useSWR from 'swr';

const sections = {
    data: [
        {
            id: 1,
            program_id: 1,
            facility_id: 1,
            facility: {
                name: 'MVCF'
            },
            facilitator: 'Linus Torvalds',
            start_date: '2021-07-01',
            end_date: '2021-07-31',
            enrolled_residents: 10,
            capacity: 15
        },
        {
            id: 2,
            program_id: 1,
            facility_id: 1,
            facility: {
                name: 'BCF'
            },
            facilitator: 'Alex Trebek',
            start_date: '2021-08-01',
            end_date: '2021-08-31',
            enrolled_residents: 14,
            capacity: 30
        },
        {
            id: 3,
            program_id: 1,
            facility_id: 1,
            facility: {
                name: 'Potosi'
            },
            facilitator: 'Mark Smith',
            start_date: '2021-09-01',
            end_date: '2021-09-30',
            enrolled_residents: 16,
            capacity: 40
        }
    ]
};

export default function ProgramOverview() {
    const { id } = useParams<{ id: string }>();
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedSections, setSelectedSections] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>('name_last asc');
    const [includeActive, setIncludeActive] = useState(true);

    const [showAllSections, setShowAllSections] = useState(false);
    const { data: programResp, error: programError } = useSWR<
        ServerResponseOne<Program>,
        AxiosError
    >(`/api/programs/${id}`);
    const program = programResp?.data;

    const meta = {
        current_page: page,
        per_page: perPage,
        total: sections.data.length,
        last_page: Math.ceil(sections.data.length / perPage)
    };

    if (programError) {
        <Error />;
    }

    const allSelected =
        selectedSections.length === sections.data.length &&
        sections.data.length > 0;

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelectedSections(sections.data.map((s) => s.id));
        } else {
            setSelectedSections([]);
        }
    }

    function handleToggleRow(sectionId: number) {
        setSelectedSections((prev) =>
            prev.includes(sectionId)
                ? prev.filter((id) => id !== sectionId)
                : [...prev, sectionId]
        );
    }

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPage(1);
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPage(1);

        setIncludeActive(includeActive); // Same deal just to get eslint to be quiet
        setSortQuery(sortQuery); //Just to get eslint to stop complaining remove when this is is built out
    };

    return (
        <div className="p-4 px-5">
            <h1 className=" mb-2">{program?.name}</h1>
            <p className="mb-4 body body-small ">{program?.description}</p>

            <div className="flex gap-4 mb-8 ">
                <div className="flex flex-col gap-4 h-[250px]">
                    <StatsCard
                        title="Residents Enrolled"
                        number="104"
                        label="residents"
                        tooltip="Placeholder data"
                    />
                    <StatsCard
                        title="Overall Completion"
                        number="50"
                        label="%"
                        tooltip="Placeholder data"
                    />
                </div>

                <div className="flex-1 card p-2 h-[250px]">
                    <h3 className="text-lg font-bold text-teal-4 text-center mb-2">
                        PROGRAM OUTCOMES
                    </h3>
                    <ProgramOutcomes />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex flex-row gap-x-2">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <DropdownControl
                        label="order by"
                        setState={setSortQuery}
                        enumType={{
                            'Facility (A-Z)': 'facility_name asc',
                            'Facility (Z-A)': 'facility_name desc',
                            'Enrollment Count (Most)': 'enrollment desc',
                            'Enrollment Count (Least)': 'enrollment asc',
                            'Start Date (Earliest)': 'start_date asc',
                            'Start Date (Latest)': 'start_date desc'
                        }}
                    />
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm mr-2"
                            checked={showAllSections}
                            onChange={(e) => {
                                setShowAllSections(e.target.checked);
                                setIncludeActive(!e.target.checked);
                            }}
                        />
                        <span className="text-sm">Show All Sections</span>
                    </div>
                </div>

                <button className="button flex items-center">
                    <PlusCircleIcon className="w-4 h-4 mr-1" />
                    Add Section
                </button>
            </div>

            {/* sections table */}
            <div className="card p-4">
                <table className="table w-full mb-4">
                    <thead className="bg-background">
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={allSelected}
                                    onChange={(e) =>
                                        handleToggleAll(e.target.checked)
                                    }
                                />
                            </th>
                            <th>Facility Name</th>
                            <th>Facilitator</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Enrollment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.data.map((section) => {
                            const isSelected = selectedSections.includes(
                                section.id
                            );
                            return (
                                <tr
                                    key={section.id}
                                    onClick={() => handleToggleRow(section.id)}
                                    className={`cursor-pointer ${
                                        isSelected ? 'bg-background ' : ''
                                    }`}
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={isSelected}
                                            onChange={() =>
                                                handleToggleRow(section.id)
                                            }
                                        />
                                    </td>
                                    <td>{section.facility.name}</td>
                                    <td>{section.facilitator}</td>
                                    <td>
                                        {new Date(
                                            section.start_date
                                        ).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </td>
                                    <td>
                                        {new Date(
                                            section.end_date
                                        ).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </td>
                                    <td>
                                        <ProgressBar
                                            showPercentage={false}
                                            percent={parseFloat(
                                                (
                                                    (section.enrolled_residents /
                                                        section.capacity) *
                                                    100
                                                ).toFixed(1)
                                            )}
                                            numerator={
                                                section.enrolled_residents
                                            }
                                            denominator={section.capacity}
                                        />
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
        </div>
    );
}
