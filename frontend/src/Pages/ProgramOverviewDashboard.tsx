import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import { ArchiveBoxIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { Program, ServerResponseOne } from '@/common';
import { AxiosError } from 'axios';
import Error from '@/Pages/Error';
import ProgramOutcomes from '@/Components/ProgramOutcomes';
import ProgressBar from '@/Components/ProgressBar';
import useSWR from 'swr';
import SectionStatus, {
    SelectedSectionStatus
} from '@/Components/SectionStatus';
import { showModal, TextModalType, TextOnlyModal } from '@/Components/modals';
import ULIComponent from '@/Components/ULIComponent';
import { XMarkIcon } from '@heroicons/react/24/solid';

export interface Section {
    id: number;
    program_id: number;
    facility_id: number;
    facility: {
        name: string;
    };
    facilitator: string;
    start_date: string;
    end_date: string;
    status: SelectedSectionStatus;
    enrolled_residents: number;
    capacity: number;
    archivedAt: string | null; // double check how this is returned, and if it would be null or undefined
}

const sections: { data: Section[] } = {
    data: [
        {
            id: 1,
            program_id: 1,
            facility_id: 1,
            facility: {
                name: 'Mountain View Correctional Facility'
            },
            facilitator: 'Linus Torvalds',
            start_date: '2021-07-01',
            end_date: '2021-07-31',
            status: SelectedSectionStatus.Canceled,
            enrolled_residents: 10,
            capacity: 15,
            archivedAt: null
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
            status: SelectedSectionStatus.Active,
            enrolled_residents: 14,
            capacity: 30,
            archivedAt: null
        },
        {
            id: 3,
            program_id: 1,
            facility_id: 1,
            facility: {
                name: 'Potosi Correctional Center'
            },
            facilitator: 'Mark Smith',
            start_date: '2021-09-01',
            end_date: '2021-09-30',
            status: SelectedSectionStatus.Paused,
            enrolled_residents: 16,
            capacity: 40,
            archivedAt: null
        },
        {
            id: 4,
            program_id: 1,
            facility_id: 2,
            facility: {
                name: 'JCF'
            },
            facilitator: 'Ada Lovelace',
            start_date: '2021-10-01',
            end_date: '2021-10-31',
            status: SelectedSectionStatus.Scheduled,
            enrolled_residents: 20,
            capacity: 25,
            archivedAt: null
        },
        {
            id: 5,
            program_id: 1,
            facility_id: 3,
            facility: {
                name: 'Alcatraz'
            },
            facilitator: 'Grace Hopper',
            start_date: '2021-11-01',
            end_date: '2021-11-30',
            status: SelectedSectionStatus.Completed,
            enrolled_residents: 25,
            capacity: 30,
            archivedAt: '2021-12-01'
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
    const [includeArchived, setIncludeArchived] = useState(false);
    const archiveSectionsRef = useRef<HTMLDialogElement>(null);

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

    const nonArchivedSections = sections.data.filter(
        (section) => section.archivedAt === null
    );

    const allSelected =
        selectedSections.length === nonArchivedSections.length &&
        nonArchivedSections.length > 0;

    const filteredSections = includeArchived
        ? sections.data
        : nonArchivedSections;

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelectedSections(nonArchivedSections.map((s) => s.id));
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
        setSortQuery(sortQuery); //Just to get eslint to stop complaining remove when this is is built out
    };

    function confirmArchiveSections() {
        showModal(archiveSectionsRef);
    }

    const [unableToArchiveSections, setUnableToArchiveSections] = useState<
        Section[]
    >([]);
    const [ableToArchiveSections, setAbleToArchiveSections] = useState<
        Section[]
    >([]);

    useEffect(() => {
        const unableToArchive = sections.data.filter(
            (section) =>
                selectedSections.includes(section.id) &&
                (section.status === SelectedSectionStatus.Active ||
                    section.status === SelectedSectionStatus.Scheduled) &&
                section.enrolled_residents > 1
        );

        const ableToArchive = sections.data.filter(
            (section) =>
                selectedSections.includes(section.id) &&
                !unableToArchive.includes(section)
        );

        setUnableToArchiveSections(unableToArchive);
        setAbleToArchiveSections(ableToArchive);
    }, [selectedSections]);

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
                            onChange={(e) => {
                                setIncludeArchived(e.target.checked);
                            }}
                        />
                        <span className="text-sm">
                            Include Archived Sections
                        </span>
                    </div>
                </div>
                {selectedSections.length > 0 ? (
                    <button
                        className="button flex items-center bg-pale-yellow border border-dark-yellow text-body-text"
                        onClick={confirmArchiveSections}
                    >
                        <ArchiveBoxIcon className="w-4 h-4 mr-1" />
                        Archive Section{selectedSections.length > 1 ? 's' : ''}
                    </button>
                ) : (
                    <button className="button flex items-center">
                        <PlusCircleIcon className="w-4 h-4 mr-1" />
                        Add Section
                    </button>
                )}
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
                            <th className="w-[200px]">Enrollment</th>
                            <th className="w-[150px]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSections.map((section) => {
                            const isSelected = selectedSections.includes(
                                section.id
                            );
                            return (
                                <tr
                                    key={section.id}
                                    onClick={() => {
                                        if (section.archivedAt === null)
                                            handleToggleRow(section.id);
                                    }}
                                    className={
                                        section.archivedAt
                                            ? 'bg-grey-1 cursor-not-allowed'
                                            : `cursor-pointer ${
                                                  isSelected
                                                      ? 'bg-background '
                                                      : ''
                                              }`
                                    }
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={isSelected}
                                            onChange={() =>
                                                handleToggleRow(section.id)
                                            }
                                            disabled={
                                                section.archivedAt !== null
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
                                    <td>
                                        <SectionStatus
                                            status={section.status}
                                            section={section}
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

            <TextOnlyModal
                ref={archiveSectionsRef}
                type={TextModalType.Confirm}
                title={`Archive Section${selectedSections.length > 1 ? 's' : ''}`}
                text={
                    <div>
                        {unableToArchiveSections.length > 0 && (
                            <div className="text-error">
                                <p className="text-error font-bold">
                                    We are unable to archive the following
                                    sections due to their active or scheduled
                                    status with enrolled students:
                                </p>
                                <ul className="py-2">
                                    {unableToArchiveSections.map((section) => (
                                        <li
                                            key={section.id}
                                            className="inline-flex items-center gap-2"
                                        >
                                            <ULIComponent icon={XMarkIcon} />
                                            {section.facility.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <br />
                        <p>
                            Archive these sections at the following facilities?
                        </p>
                        <ul className="list-disc list-inside py-2">
                            {ableToArchiveSections.map((section) => (
                                <li key={section.id}>
                                    {section.facility.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                }
                onSubmit={() => console.log('submit archive section')}
                onClose={() => console.log('close archive section')}
            ></TextOnlyModal>
        </div>
    );
}
