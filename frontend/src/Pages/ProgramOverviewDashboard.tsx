import { useParams } from 'react-router-dom';
import { useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { ProgramDashboard, ServerResponseMany } from '@/common';
import { AxiosError } from 'axios';
import Error from '@/Pages/Error';
import ProgramOutcomes from '@/Components/ProgramOutcomes';
import ProgressBar from '@/Components/ProgressBar';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';

export default function ProgramOverview() {
    const { id } = useParams<{ id: string }>();
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedSections, setSelectedSections] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>('name_last asc');
    const [includeActive, setIncludeActive] = useState(true);
    const navigate = useNavigate();
    const [showAllSections, setShowAllSections] = useState(false);
    const {
        data: programResp,
        error: programError,
        mutate
    } = useSWR<ServerResponseMany<ProgramDashboard>, AxiosError>(
        `/api/programs/${id}/overview?page=${page}&per_page=${perPage}`
    );
    const program = programResp?.data[0];
    const meta = program?.meta ?? {
        total: 0,
        per_page: 20,
        page: 1,
        current_page: 1,
        last_page: 1
    };

    if (programError) {
        <Error />;
    }

    const allSelected = selectedSections
        ? selectedSections.length === program?.section_details.length &&
          program?.section_details.length > 0
        : false;

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelectedSections(
                program?.section_details.map((s) => s.id) ?? []
            );
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
        void mutate();
        setIncludeActive(includeActive); // Same deal just to get eslint to be quiet
        setSortQuery(sortQuery); //Just to get eslint to stop complaining remove when this is is built out
    };

    const handleNavigateEnrollment = () => {
        if (selectedSections.length === 1) {
            navigate(
                `/programs/${program?.id}/section-enrollment/${selectedSections[0]}/`
            );
        }
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
                        <span className="text-sm">Show All Classes</span>
                    </div>
                </div>

                <div className="flex flex-row gap-x-2">
                    {selectedSections.length === 1 && (
                        <button
                            hidden={selectedSections.length !== 1}
                            className="button flex items-center"
                            onClick={handleNavigateEnrollment}
                        >
                            <PlusCircleIcon className="w-4 h-4 mr-1" />
                            Enroll Students
                        </button>
                    )}
                    <button
                        className="button flex items-center"
                        onClick={() =>
                            navigate(`/programs/${id}/class`, {
                                state: { title: `Program: ${program?.name}` }
                            })
                        }
                    >
                        <PlusCircleIcon className="w-4 h-4 mr-1" />
                        Add Class
                    </button>
                </div>
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
                        {program?.section_details.map((section) => {
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
                                    <td>{section.facility_name}</td>
                                    <td>{section.instructor_name}</td>
                                    <td>
                                        {new Date(
                                            section.start_dt
                                        ).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            timeZone: 'UTC'
                                        })}
                                    </td>
                                    <td>
                                        {section.end_dt
                                            ? new Date(
                                                  section.end_dt
                                              ).toLocaleDateString('en-US', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  timeZone: 'UTC'
                                              })
                                            : ''}
                                    </td>
                                    <td>
                                        <ProgressBar
                                            showPercentage={false}
                                            percent={parseFloat(
                                                (
                                                    (section.enrolled /
                                                        section.capacity) *
                                                    100
                                                ).toFixed(1)
                                            )}
                                            numerator={section.enrolled}
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
