import { useLoaderData, useParams } from 'react-router-dom';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import StatsCard from '@/Components/StatsCard';
import { ArchiveBoxIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    Class,
    SelectedClassStatus,
    ServerResponseMany,
    ProgramOverview,
    ProgramClassOutcomes
} from '@/common';
import ClampedText from '@/Components/ClampedText';
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
import { canSwitchFacility, useAuth } from '@/useAuth';
import ActivityHistoryCard from '@/Components/ActivityHistoryCard';
import { AddButton } from '@/Components/inputs';
import { getClassEndDate } from '@/Components/ClassLayout';
import WarningBanner from '@/Components/WarningBanner';
import EmptyStateCard from '@/Components/EmptyStateCard';

export function isCompletedCancelledOrArchived(program_class: Class): boolean {
    return (
        program_class.status === SelectedClassStatus.Completed ||
        program_class.status === SelectedClassStatus.Cancelled ||
        isArchived(program_class)
    );
}

export default function ProgramOverviewDashboard() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const { user } = useAuth();
    const { program, redirect } = useLoaderData() as {
        program: ProgramOverview;
        redirect: string;
    };
    if (redirect) {
        navigate(redirect);
    }
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
    const handleSetSearchTerm = (newTerm: string) => {
        startTransition(() => {
            setSearchTerm(newTerm);
        });
    };

    const {
        data: classesResp,
        error: classesError,
        mutate: mutateClasses,
        isLoading
    } = useSWR<ServerResponseMany<Class>, Error>(
        `/api/programs/${program_id}/classes?page=${page}&per_page=${perPage}&order_by=${sortQuery}`
    );

    useEffect(() => {
        if (!program) navigate('/404');
        else if (classesError) navigate('/error');
    }, [program, classesError, navigate]);

    const classes = useMemo(() => classesResp?.data ?? [], [classesResp?.data]);
    const meta = classesResp?.meta ?? {
        total: 0,
        per_page: 20,
        page: 1,
        current_page: 1,
        last_page: 1
    };

    const { data: outcomeData } = useSWR<
        ServerResponseMany<ProgramClassOutcomes>,
        Error
    >(`/api/programs/${program_id}/classes/outcomes?order_by=month`, {});
    const outcomes = outcomeData?.data ?? [];

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
        if (resp.success) {
            setSelectedClasses([]);
        }
    }
    function handleCloseArchive() {
        archiveClassesRef.current?.close();
    }

    function commaSeparatedList<T extends string>(
        enumArray: T[] | null | undefined
    ): string {
        if (!Array.isArray(enumArray) || enumArray.length === 0) return '';
        return enumArray
            .map((ele) => String(ele).replace(/_/g, ' '))
            .join(', ');
    }

    type ProgramStatus =
        | 'active'
        | 'inactiveProgram'
        | 'archivedProgram'
        | 'notOfferedAtFacility';

    function getProgramStatus(
        program: ProgramOverview,
        userFacilityId: number | undefined
    ): ProgramStatus {
        if (
            !userFacilityId ||
            !program?.facilities?.some((f) => f.id === userFacilityId)
        )
            return 'notOfferedAtFacility';
        if (!program?.is_active) return 'inactiveProgram';
        if (program.archived_at !== null) return 'archivedProgram';
        return 'active';
    }

    const status = getProgramStatus(program, user?.facility.id);
    const canAddClass = status === 'active';

    function getTooltip(): string | undefined {
        const tooltipMap: Record<ProgramStatus, string | undefined> = {
            active: undefined,
            inactiveProgram:
                'This program is inactive and cannot accept new classes.',
            archivedProgram:
                'This program has been archived and cannot be modified.',
            notOfferedAtFacility:
                'This program is not available at the selected facility.'
        };
        return tooltipMap[status];
    }

    return (
        <div className="p-4 px-5">
            <div className="flex flex-col gap-4">
                {status === 'notOfferedAtFacility' && (
                    <WarningBanner
                        text={` This program is not currently offered at ${user?.facility.name}.`}
                    />
                )}
                <div className="grid grid-cols-5 gap-4 items-stretch">
                    <div className="card card-row-padding col-span-3 gap-4">
                        <div className="flex gap-2">
                            <h1>{program?.name}</h1>
                            {canSwitchFacility(user!) && (
                                <button
                                    className="body text-teal-3 cursor-pointer flex items-center gap-1"
                                    onClick={(e) => {
                                        e?.stopPropagation();
                                        navigate(
                                            `/programs/detail/${program?.id}`
                                        );
                                    }}
                                >
                                    <ULIComponent icon={PencilSquareIcon} />
                                    <span className="hover:underline">
                                        Edit Program
                                    </span>
                                </button>
                            )}
                        </div>
                        <p className="body-small">{program?.description}</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h3 className="body">Program Status</h3>
                                <p className="body-small">
                                    {program?.is_active
                                        ? 'Available'
                                        : 'Inactive'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="body">Credit Type</h3>
                                <p className="body-small">
                                    {' '}
                                    {commaSeparatedList(
                                        program?.credit_types.map(
                                            (ct) => ct.credit_type
                                        )
                                    )}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="body">Program Type</h3>
                                <p className="body-small">
                                    {commaSeparatedList(
                                        program?.program_types.map(
                                            (pt) => pt.program_type
                                        )
                                    )}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="body">Funding Type</h3>
                                <p className="body-small">
                                    {commaSeparatedList([
                                        program?.funding_type
                                    ])}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 col-span-2">
                        <StatsCard
                            title="Active Enrollments"
                            number={
                                program?.active_enrollments.toString() ?? '0'
                            }
                            label={
                                program?.active_enrollments &&
                                program.active_enrollments == 1
                                    ? 'Enrollment'
                                    : 'Enrollments'
                            }
                        />
                        <StatsCard
                            title="Active Residents"
                            number={program?.active_residents.toString() ?? '0'}
                            label="residents"
                        />
                        <div className="col-span-2">
                            <StatsCard
                                title="Overall Completion"
                                number={
                                    program?.completion_rate.toString() ?? '0'
                                }
                                label="%"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 mt-4">
                <div className="flex flex-row gap-x-2">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={(newTerm) => {
                            handleSetSearchTerm(newTerm);
                            setPage(1);
                        }}
                    />
                    <DropdownControl
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
                    {selectedClasses.length > 0 ? (
                        <button
                            className="button-outline-pale-yellow"
                            onClick={confirmArchiveClasses}
                        >
                            <ArchiveBoxIcon className="w-4 h-4 mr-1" />
                            Archive Class
                            {selectedClasses.length > 1 ? 'es' : ''}
                        </button>
                    ) : (
                        <AddButton
                            dataTip={getTooltip()}
                            disabled={!canAddClass}
                            label="Add Class"
                            onClick={() =>
                                navigate(`/programs/${program_id}/classes/new`)
                            }
                        />
                    )}
                </div>
            </div>

            {/* classes table */}
            <div className="card p-4">
                <table className="table-2 table-fixed w-full mb-4">
                    <thead className="table-header-group bg-background text-center">
                        <tr className="!table-row">
                            <th className="w-[40px] py-2">
                                <input
                                    type="checkbox"
                                    className="cursor-pointer checkbox checkbox-sm"
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

                    <tbody className="!table-row-group text-center">
                        {isLoading ? (
                            <tr className="!table-row">
                                <td colSpan={7} className="py-8">
                                    <div>Loading...</div>
                                </td>
                            </tr>
                        ) : filteredClasses && filteredClasses.length > 0 ? (
                            filteredClasses.map((pc) => {
                                const isSelected = selectedClasses.includes(
                                    pc.id
                                );
                                return (
                                    <tr
                                        key={pc.id}
                                        className={`!table-row ${isArchived(pc) ? 'bg-grey-1' : ''} ${isSelected ? 'bg-background' : ''}`}
                                    >
                                        <td
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-[40px] py-2"
                                        >
                                            <input
                                                type="checkbox"
                                                className={`cursor-pointer checkbox checkbox-sm ${
                                                    isArchived(pc)
                                                        ? 'invisible'
                                                        : ''
                                                }`}
                                                checked={isSelected}
                                                disabled={isArchived(pc)}
                                                onChange={() =>
                                                    handleToggleRow(pc.id)
                                                }
                                            />
                                        </td>

                                        <td className="px-4 py-2 cursor-pointer">
                                            <div
                                                onClick={() =>
                                                    navigate(
                                                        `/program-classes/${pc.id}/dashboard`
                                                    )
                                                }
                                            >
                                                <ClampedText
                                                    as="div"
                                                    lines={1}
                                                    className="hover:underline"
                                                >
                                                    {pc.name}
                                                </ClampedText>
                                            </div>
                                        </td>

                                        <td>
                                            <ClampedText as="div" lines={1}>
                                                {pc.instructor_name}
                                            </ClampedText>
                                        </td>

                                        <td className="px-4 py-2">
                                            {new Date(
                                                pc.start_dt
                                            ).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                timeZone: 'UTC'
                                            })}
                                        </td>
                                        <td className="px-4 py-2">
                                            {(() => {
                                                const classEndDate =
                                                    getClassEndDate(
                                                        pc?.events ?? []
                                                    );
                                                return classEndDate
                                                    ? classEndDate.toLocaleDateString(
                                                          'en-US',
                                                          {
                                                              year: 'numeric',
                                                              month: 'long',
                                                              day: 'numeric',
                                                              timeZone: 'UTC'
                                                          }
                                                      )
                                                    : 'No end date';
                                            })()}
                                        </td>

                                        <td className="px-4 py-2">
                                            <ProgressBar
                                                showPercentage={false}
                                                percent={parseFloat(
                                                    (
                                                        (pc.enrolled /
                                                            pc.capacity) *
                                                        100
                                                    ).toFixed(1)
                                                )}
                                                numerator={pc.enrolled}
                                                denominator={pc.capacity}
                                            />
                                        </td>

                                        <td className="px-4 py-2">
                                            <ClassStatus
                                                status={pc.status}
                                                program_class={pc}
                                                mutateClasses={mutateClasses}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <td colSpan={7}>
                                <EmptyStateCard
                                    title="There are no active or scheduled classes for this program."
                                    tooltipText="Create or schedule your first class"
                                    onActionButtonText={
                                        canAddClass ? 'Add Class' : undefined
                                    }
                                    onActionButtonClick={
                                        canAddClass
                                            ? () =>
                                                  navigate(
                                                      `/programs/${program_id}/classes/new`
                                                  )
                                            : undefined
                                    }
                                />
                            </td>
                        )}
                    </tbody>
                </table>

                {meta && filteredClasses.length > 0 && !isLoading && (
                    <div className="flex justify-center mt-4">
                        <Pagination
                            meta={meta}
                            setPage={setPage}
                            setPerPage={handleSetPerPage}
                        />
                    </div>
                )}
            </div>
            <div className="grid grid-cols-3 gap-6 items-stretch mt-4">
                <div className="col-span-1">
                    <ActivityHistoryCard programId={program_id} />
                </div>

                <div className="col-span-2">
                    <div className="flex-1 card p-2 h-[250px]">
                        <h3 className="text-lg font-bold text-teal-4 text-center mb-2">
                            PROGRAM OUTCOMES
                        </h3>
                        <ProgramOutcomes data={outcomes} />
                    </div>
                </div>
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
                                    Are you sure you would like to archive{' '}
                                    {ableToArchiveClasses.length == 1
                                        ? 'this class'
                                        : 'these selected classes'}
                                    ?
                                </p>
                                {ableToArchiveClasses.length > 1 && (
                                    <ul className="list-disc list-inside py-2">
                                        {ableToArchiveClasses.map(
                                            (program_class) => (
                                                <li key={program_class.id}>
                                                    {program_class.name}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                }
                onSubmit={() => void archiveClass()}
                onClose={handleCloseArchive}
            ></TextOnlyModal>
        </div>
    );
}
