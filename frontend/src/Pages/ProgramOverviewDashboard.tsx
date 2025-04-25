import { useLoaderData, useParams } from 'react-router-dom';
import { startTransition, useEffect, useRef, useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import {
    ArchiveBoxIcon,
    PlusCircleIcon,
    PencilSquareIcon
} from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    Program,
    Class,
    SelectedClassStatus,
    ServerResponseMany
} from '@/common';
import Error from '@/Pages/Error';
import ProgramOutcomes from '@/Components/ProgramOutcomes';
import ProgressBar from '@/Components/ProgressBar';
import useSWR from 'swr';
import ClassStatus, { isArchived } from '@/Components/ClassStatus';
import { showModal, TextModalType, TextOnlyModal } from '@/Components/modals';
import ULIComponent from '@/Components/ULIComponent';
import { XMarkIcon } from '@heroicons/react/24/solid';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/useAuth';

export default function ProgramOverview() {
    const { id } = useParams<{ id: string }>();
    const user = useAuth();
    const userFacilityId = user.user?.facility_id;
    const program = useLoaderData() as Program;
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>('ps.start_dt asc');
    const [includeArchived, setIncludeArchived] = useState(false);
    const archiveClassesRef = useRef<HTMLDialogElement>(null);
    const [unableToArchiveClasses, setUnableToArchiveClasses] = useState<
        Class[]
    >([]);
    const [ableToArchiveClasses, setAbleToArchiveClasses] = useState<Class[]>(
        []
    );
    const navigate = useNavigate();
    const handleSetSearchTerm = (newTerm: string) => {
        startTransition(() => {
            setSearchTerm(newTerm);
        });
    };

    const {
        data: classesResp,
        error: classesError,
        mutate: mutateClasses
    } = useSWR<ServerResponseMany<Class>, Error>(
        `/api/programs/${id}/classes?page=${page}&per_page=${perPage}&order_by=${sortQuery}`
    );
    if (!program) {
        navigate('/404');
    } else if (classesError) {
        navigate('/error');
    }
    const classes = classesResp?.data ?? [];

    const meta = classesResp?.meta ?? {
        total: 0,
        per_page: 20,
        page: 1,
        current_page: 1,
        last_page: 1
    };

    const checkResponse = useCheckResponse({
        mutate: mutateClasses,
        refModal: archiveClassesRef
    });

    useEffect(() => {
        if (classes === undefined) return;
        const unableToArchive = classes.filter(
            (program_class) =>
                selectedClasses.includes(program_class.id) &&
                (program_class.status === SelectedClassStatus.Active ||
                    program_class.status === SelectedClassStatus.Scheduled) &&
                program_class.enrolled >= 1
        );

        const ableToArchive = classes.filter(
            (program_class) =>
                selectedClasses.includes(program_class.id) &&
                !unableToArchive.includes(program_class)
        );

        setUnableToArchiveClasses(unableToArchive);
        setAbleToArchiveClasses(ableToArchive);
    }, [selectedClasses, classes]);

    if (classes === undefined) return <br />;

    const nonArchivedClasses = classes?.filter(
        (program_class) => !isArchived(program_class)
    );

    const allSelected =
        selectedClasses.length === nonArchivedClasses?.length &&
        nonArchivedClasses?.length > 0;

    const filteredClasses = includeArchived ? classes : nonArchivedClasses;

    function handleToggleAll(checked: boolean) {
        if (checked) {
            setSelectedClasses(nonArchivedClasses?.map((s) => s.id) ?? []);
        } else {
            setSelectedClasses([]);
        }
    }

    function handleToggleRow(classId: number) {
        setSelectedClasses((prev) =>
            prev.includes(classId)
                ? prev.filter((id) => id !== classId)
                : [...prev, classId]
        );
    }

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPage(1);
        setSortQuery(sortQuery); //Just to get eslint to stop complaining remove when this is is built out
    };

    const handleNavigateEnrollmentDetails = () => {
        if (selectedClasses.length === 1) {
            navigate(
                `/programs/${program?.id}/classes/${selectedClasses[0]}/enrollments`
            );
        }
    };
    function confirmArchiveClasses() {
        showModal(archiveClassesRef);
    }

    async function archiveClass() {
        const selectedAbleToArchiveClasses = selectedClasses.filter((id) =>
            ableToArchiveClasses.some(
                (program_class) => program_class.id === id
            )
        );
        const idString = '?id=' + selectedAbleToArchiveClasses.join('&id=');
        const resp = await API.patch(`program-classes${idString}`, {
            archived_at: new Date().toISOString()
        });
        checkResponse(
            resp.success,
            'Unable to update class',
            'Class updated successfully'
        );
        if (resp.success) setSelectedClasses([]);
    }

    const isAddClassDisabled = !program.facilities.some(
        (facility) => facility.id === userFacilityId
    );
    return (
        <div className="p-4 px-5">
            <h1 className=" mb-2">{program.name}</h1>
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
                        changeCallback={(newTerm) => {
                            handleSetSearchTerm(newTerm);
                            setPage(1);
                        }}
                    />
                    <DropdownControl
                        label="order by"
                        setState={setSortQuery}
                        enumType={{
                            'Enrollment Count (Most)': 'enrolled desc',
                            'Enrollment Count (Least)': 'enrolled asc',
                            'Start Date (Earliest)': 'ps.start_dt asc',
                            'Start Date (Latest)': 'ps.start_dt desc'
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
                    {selectedClasses.length === 1 && (
                        <button
                            hidden={selectedClasses.length !== 1}
                            className="button flex items-center"
                            onClick={handleNavigateEnrollmentDetails}
                        >
                            <PlusCircleIcon className="w-4 h-4 mr-1" />
                            View Enrollment Details
                        </button>
                    )}
                    {selectedClasses.length > 0 ? (
                        <button
                            className="button flex items-center bg-pale-yellow border border-dark-yellow text-body-text"
                            onClick={confirmArchiveClasses}
                        >
                            <ArchiveBoxIcon className="w-4 h-4 mr-1" />
                            Archive Class
                            {selectedClasses.length > 1 ? 'es' : ''}
                        </button>
                    ) : (
                        <button
                            className={`button flex items-center ${isAddClassDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() =>
                                navigate(`/programs/${id}/classes/new`)
                            }
                            disabled={isAddClassDisabled}
                        >
                            <PlusCircleIcon className="w-4 h-4 mr-1" />
                            Add Class
                        </button>
                    )}
                </div>
            </div>

            {/* classes table */}
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
                            <th>Class Name</th>
                            <th>Instructor Name</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th className="w-[200px]">Enrollments</th>
                            <th className="w-[150px]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClasses.map((program_class) => {
                            const isSelected = selectedClasses.includes(
                                program_class.id
                            );
                            return (
                                <tr
                                    key={program_class.id}
                                    onClick={() => {
                                        if (!isArchived(program_class))
                                            handleToggleRow(program_class.id);
                                    }}
                                    className={
                                        isArchived(program_class)
                                            ? 'bg-grey-1 cursor-not-allowed'
                                            : `cursor-pointer ${
                                                  isSelected
                                                      ? 'bg-background '
                                                      : ''
                                              }`
                                    }
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            {isArchived(program_class) ? (
                                                <div></div>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        handleToggleRow(
                                                            program_class.id
                                                        )
                                                    }
                                                />
                                            )}
                                            <ULIComponent
                                                icon={PencilSquareIcon}
                                                iconClassName={
                                                    '!w-5 !h-5 cursor-pointer'
                                                }
                                                onClick={() => {
                                                    navigate(
                                                        `/programs/${id}/classes/${program_class.id}`
                                                    );
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td> {program_class.name}</td>
                                    <td>{program_class.instructor_name}</td>
                                    <td>
                                        {new Date(
                                            program_class.start_dt
                                        ).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            timeZone: 'UTC'
                                        })}
                                    </td>
                                    <td>
                                        {program_class.end_dt
                                            ? new Date(
                                                  program_class.end_dt
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
                                                    (program_class.enrolled /
                                                        program_class.capacity) *
                                                    100
                                                ).toFixed(1)
                                            )}
                                            numerator={program_class.enrolled}
                                            denominator={program_class.capacity}
                                        />
                                    </td>
                                    <td>
                                        <ClassStatus
                                            status={program_class.status}
                                            program_class={program_class}
                                            mutateClasses={mutateClasses}
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
                ref={archiveClassesRef}
                type={
                    ableToArchiveClasses.length == 0
                        ? TextModalType.Information
                        : TextModalType.Confirm
                }
                title={`Archive Class${selectedClasses.length > 1 ? 'es' : ''}`}
                text={
                    <div>
                        {unableToArchiveClasses.length > 0 && (
                            <>
                                <div className="text-error">
                                    <p className="text-error font-bold">
                                        We are unable to archive the following
                                        classes due to their active or scheduled
                                        status with enrolled students:
                                    </p>
                                    <ul className="py-2">
                                        {unableToArchiveClasses.map(
                                            (program_class) => (
                                                <li
                                                    key={program_class.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    <ULIComponent
                                                        icon={XMarkIcon}
                                                    />
                                                    {
                                                        program_class.facility_name
                                                    }
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                                <br />
                            </>
                        )}
                        {ableToArchiveClasses.length != 0 && (
                            <>
                                <p>
                                    Archive these classes at the following
                                    facilities?
                                </p>
                                <ul className="list-disc list-inside py-2">
                                    {ableToArchiveClasses.map(
                                        (program_class) => (
                                            <li key={program_class.id}>
                                                {program_class.facility_name}
                                            </li>
                                        )
                                    )}
                                </ul>
                            </>
                        )}
                    </div>
                }
                onSubmit={() => void archiveClass()}
                onClose={() => console.log('close archive class')}
            ></TextOnlyModal>
        </div>
    );
}
