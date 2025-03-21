import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import { ArchiveBoxIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    ProgramDashboard,
    Program,
    Section,
    SelectedSectionStatus,
    ServerResponseOne,
    ServerResponseMany
} from '@/common';
import { AxiosError } from 'axios';
import Error from '@/Pages/Error';
import ProgramOutcomes from '@/Components/ProgramOutcomes';
import ProgressBar from '@/Components/ProgressBar';
import useSWR from 'swr';
import SectionStatus from '@/Components/SectionStatus';
import { showModal, TextModalType, TextOnlyModal } from '@/Components/modals';
import ULIComponent from '@/Components/ULIComponent';
import { XMarkIcon } from '@heroicons/react/24/solid';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useNavigate } from 'react-router-dom';

export default function ProgramOverview() {
    const { id } = useParams<{ id: string }>();
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedSections, setSelectedSections] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>('name_last asc');
    const [includeArchived, setIncludeArchived] = useState(false);
    const archiveSectionsRef = useRef<HTMLDialogElement>(null);
    const [unableToArchiveSections, setUnableToArchiveSections] = useState<
        Section[]
    >([]);
    const [ableToArchiveSections, setAbleToArchiveSections] = useState<
        Section[]
    >([]);
    const navigate = useNavigate();

    const { data: programResp, error: programError } = useSWR<
        ServerResponseOne<Program>,
        AxiosError
    >(`/api/programs/${id}`);
    const program = programResp?.data;

    const {
        data: sectionsResp,
        error: sectionsError,
        mutate: mutateSections
    } = useSWR<ServerResponseMany<Section>, AxiosError>(
        `/api/programs/${id}/sections`
    );

    const sections = sectionsResp?.data;

    const checkResponse = useCheckResponse({
        mutate: mutateSections,
        refModal: archiveSectionsRef
    });

    useEffect(() => {
        if (sections === undefined) return;
        const unableToArchive = sections.filter(
            (section) =>
                selectedSections.includes(section.id) &&
                (section.status === SelectedSectionStatus.Active ||
                    section.status === SelectedSectionStatus.Scheduled) &&
                section.enrolled >= 1
        );

        const ableToArchive = sections.filter(
            (section) =>
                selectedSections.includes(section.id) &&
                !unableToArchive.includes(section)
        );

        setUnableToArchiveSections(unableToArchive);
        setAbleToArchiveSections(ableToArchive);
    }, [selectedSections]);

    if (programError || sectionsError || sections === undefined) {
        return <Error />;
    }

    const meta = {
        current_page: page,
        per_page: perPage,
        total: sections.length,
        last_page: Math.ceil(sections.length / perPage)
    };

    const nonArchivedSections = sections.filter(
        (section) =>
            section.archived_at === null ||
            section.archived_at === '0001-01-01T00:00:00Z'
    );

    const allSelected =
        selectedSections.length === nonArchivedSections.length &&
        nonArchivedSections.length > 0;

    const filteredSections = includeArchived ? sections : nonArchivedSections;

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

    const handleNavigateEnrollment = () => {
        if (selectedSections.length === 1) {
            navigate(
                `/programs/${program?.id}/section-enrollment/${selectedSections[0]}/`
            );
        }
    };
    function confirmArchiveSections() {
        showModal(archiveSectionsRef);
    }

    async function archiveSection() {
        const idString = '?id=' + selectedSections.join('&id=');
        const resp = await API.patch(`program-sections${idString}`, {
            archived_at: new Date().toISOString()
        });
        checkResponse(
            resp.success,
            'Unable to update section',
            'Section updated successfully'
        );
        if (resp.success) setSelectedSections([]);
    }

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
                            Include Archived Classes
                        </span>
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
                    {selectedSections.length > 0 ? (
                        <button
                            className="button flex items-center bg-pale-yellow border border-dark-yellow text-body-text"
                            onClick={confirmArchiveSections}
                        >
                            <ArchiveBoxIcon className="w-4 h-4 mr-1" />
                            Archive Class
                            {selectedSections.length > 1 ? 'es' : ''}
                        </button>
                    ) : (
                        <button
                            className="button flex items-center"
                            onClick={() =>
                                navigate(`/programs/${id}/class`, {
                                    state: {
                                        title: `Program: ${program?.name}`
                                    }
                                })
                            }
                        >
                            <PlusCircleIcon className="w-4 h-4 mr-1" />
                            Add Class
                        </button>
                    )}
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
                            <th>Instructor Name</th>
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
                            const notArchived =
                                section.archived_at === null ||
                                section.archived_at === '0001-01-01T00:00:00Z';
                            return (
                                <tr
                                    key={section.id}
                                    onClick={() => {
                                        if (notArchived)
                                            handleToggleRow(section.id);
                                    }}
                                    className={
                                        notArchived
                                            ? `cursor-pointer ${
                                                  isSelected
                                                      ? 'bg-background '
                                                      : ''
                                              }`
                                            : 'bg-grey-1 cursor-not-allowed'
                                    }
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        {notArchived ? (
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={isSelected}
                                                onChange={() =>
                                                    handleToggleRow(section.id)
                                                }
                                                disabled={!notArchived}
                                            />
                                        ) : (
                                            <div></div>
                                        )}
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
                                    <td>
                                        <SectionStatus
                                            status={section.status}
                                            section={section}
                                            mutateSections={mutateSections}
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
                            <>
                                <div className="text-error">
                                    <p className="text-error font-bold">
                                        We are unable to archive the following
                                        sections due to their active or
                                        scheduled status with enrolled students:
                                    </p>
                                    <ul className="py-2">
                                        {unableToArchiveSections.map(
                                            (section) => (
                                                <li
                                                    key={section.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    <ULIComponent
                                                        icon={XMarkIcon}
                                                    />
                                                    {section.facility_name}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                                <br />
                            </>
                        )}
                        <p>
                            Archive these sections at the following facilities?
                        </p>
                        <ul className="list-disc list-inside py-2">
                            {ableToArchiveSections.map((section) => (
                                <li key={section.id}>
                                    {section.facility_name}
                                </li>
                            ))}
                        </ul>
                    </div>
                }
                onSubmit={() => void archiveSection()}
                onClose={() => console.log('close archive section')}
            ></TextOnlyModal>
        </div>
    );
}
