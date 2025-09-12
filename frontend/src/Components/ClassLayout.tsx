import {
    AttendanceFlag,
    AttendanceFlagType,
    Class,
    ClassLoaderData,
    EnrollmentStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import ClassStatus from './ClassStatus';
import useSWR, { KeyedMutator } from 'swr';
import { RRule } from 'rrule';
import ActivityHistoryCard from './ActivityHistoryCard';
import { useEffect, useState } from 'react';
import Pagination from './Pagination';
import { useAuth } from '@/useAuth';
import StatsCard from './StatsCard';
import { isCompletedCancelledOrArchived } from '@/Pages/ProgramOverviewDashboard';
import { ProgramClassEvent } from '@/types/events';
import ULIComponent from './ULIComponent';
import { textMonthLocalDate } from './helperFunctions/formatting';

export function getClassEndDate(events: ProgramClassEvent[]): Date | null {
    if (!events || events.length === 0) return null;
    const latestEvent = events.reduce(
        (maxEvent, event) => (event.id > maxEvent.id ? event : maxEvent),
        events[0]
    );
    const ruleString = latestEvent.recurrence_rule;
    try {
        const rule = RRule.fromString(ruleString);
        return rule.options.until ?? null;
    } catch (error) {
        console.error('error parsing the rrule, error is: ', error);
        return null;
    }
}

function ClassInfoCard({
    classInfo,
    mutateClass
}: {
    classInfo: Class;
    mutateClass: KeyedMutator<ServerResponseOne<Class>>;
}) {
    const navigate = useNavigate();

    const programDisabled = classInfo.program.archived_at !== null;
    const blockEdits = isCompletedCancelledOrArchived(
        classInfo ?? ({} as Class)
    );

    function getNextOccurrenceDateAsStr(): string {
        const now = new Date();
        const allOccurrences: Date[] = [];

        for (const event of classInfo?.events ?? []) {
            const overrides = event.overrides ?? [];
            const cancelledDates = new Set<string>();
            const activeOverrideDates = new Set<string>();
            const activeOverrideDateTimes: Date[] = [];

            for (const override of overrides) {
                const rule = RRule.fromString(override.override_rrule);
                const date = rule.after(now, true);
                if (!date) continue;

                const dateStr = date.toISOString().slice(0, 10); //substring it
                if (override.is_cancelled) {
                    cancelledDates.add(dateStr);
                } else {
                    activeOverrideDates.add(dateStr);
                    activeOverrideDateTimes.push(date);
                }
            }

            if (event.recurrence_rule) {
                const cleanRule = event.recurrence_rule.replace(
                    /DTSTART;TZID=Local:/,
                    'DTSTART:'
                );
                const rule = RRule.fromString(cleanRule);
                const baseOccurrences = rule.between(
                    now,
                    new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365),
                    true
                );

                for (const date of baseOccurrences) {
                    const dateStr = date.toISOString().slice(0, 10);
                    if (activeOverrideDates.has(dateStr)) {
                        continue;
                    }
                    if (!cancelledDates.has(dateStr)) {
                        allOccurrences.push(date);
                    }
                }
            }
            for (const overrideDate of activeOverrideDateTimes) {
                if (overrideDate > now) {
                    allOccurrences.push(overrideDate);
                }
            }
        }
        const nextOccurrence = allOccurrences
            .filter((d) => d > now)
            .sort((a, b) => a.getTime() - b.getTime())[0];
        return nextOccurrence
            ? textMonthLocalDate(nextOccurrence, true)
            : 'No upcoming class found';
    }

    return (
        <div className="card card-row-padding flex flex-col h-full gap-4">
            <div className="flex gap-2">
                <h1>{classInfo.name}</h1>
                <button
                    className={`body text-teal-3 cursor-pointer flex items-center gap-1 ${blockEdits ? 'tooltip' : ''}`}
                    onClick={() => {
                        navigate(
                            `/programs/${classInfo.program_id}/classes/${classInfo.id}`
                        );
                    }}
                    disabled={programDisabled || blockEdits}
                    data-tip={
                        blockEdits
                            ? `This class is ${classInfo.status.toLowerCase()} and cannot be modified.`
                            : ''
                    }
                >
                    <ULIComponent icon={PencilSquareIcon} />
                    <span className="hover:underline">Edit Class</span>
                </button>
            </div>
            <p className="body-small">{classInfo.description}</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <h3 className="body">Class Status:</h3>
                    <div className="flex">
                        <ClassStatus
                            status={classInfo.status}
                            program_class={classInfo}
                            mutateClasses={mutateClass}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="body">Class Dates:</h3>
                    <p className="body-small">
                        {classInfo.start_dt &&
                            textMonthLocalDate(classInfo.start_dt)}{' '}
                        &ndash;{' '}
                        {(() => {
                            const classEndDate = getClassEndDate(
                                classInfo.events ?? []
                            );
                            return classEndDate
                                ? textMonthLocalDate(classEndDate)
                                : 'No end date scheduled';
                        })()}
                    </p>
                </div>
                <div className="space-y-2">
                    <h3 className="body">Room:</h3>
                    <p className="body-small">{classInfo.events[0].room}</p>
                </div>
                <div className="space-y-2">
                    <h3 className="body">Instructor(s)</h3>
                    <p className="body-small">{classInfo.instructor_name}</p>
                </div>
            </div>
            <p className="body">
                <span className="font-bold">Next scheduled class:</span>{' '}
                {getNextOccurrenceDateAsStr()}
            </p>
        </div>
    );
}

export default function ClassLayout() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const navigate = useNavigate();
    const clsLoader = useLoaderData() as ClassLoaderData;
    if (clsLoader.redirect) {
        navigate(clsLoader.redirect);
    }
    const { class_id } = useParams<{ class_id?: string }>();
    const { data: clsData, mutate: mutateClass } = useSWR<
        ServerResponseOne<Class>,
        Error
    >(`/api/program-classes/${class_id}`);
    const clsInfo = clsData?.data;
    const [page, setPage] = useState(1);
    const {
        data: flags,
        error: flagsError,
        mutate: mutateFlags
    } = useSWR<ServerResponseMany<AttendanceFlag>, Error>(
        `/api/program-classes/${class_id}/attendance-flags?page=${page}&per_page=5`
    );

    useEffect(() => {
        if (clsInfo?.status) {
            void mutateFlags();
        }
    }, [clsInfo?.status]);

    function getEnrollmentCount(): string {
        const enrolledCount =
            clsInfo?.enrollments?.filter(
                (e) => e.enrollment_status === EnrollmentStatus.Enrolled
            ).length ?? 0;

        return enrolledCount.toString();
    }

    function getCompletionRate(): string {
        const completedCount =
            clsInfo?.enrollments?.filter(
                (e) => e.enrollment_status === EnrollmentStatus.Completed
            ).length ?? 0;

        const incompleteCount =
            clsInfo?.enrollments?.filter(
                (e) =>
                    e.enrollment_status != EnrollmentStatus.Cancelled &&
                    e.enrollment_status != EnrollmentStatus.Completed
            ).length ?? 0;

        const combinedCount = completedCount + incompleteCount;
        const calculation =
            combinedCount === 0 ? 0 : completedCount / combinedCount;
        const completionRate = (calculation * 100).toFixed(0) + '%';
        return completionRate;
    }

    function getAttendanceRate(): string {
        let rate;
        if (clsLoader.attendance_rate) {
            rate = Math.floor(clsLoader.attendance_rate).toString() + '%';
        } else {
            rate = '0%';
        }
        return rate;
    }

    const enrollmentCount = getEnrollmentCount();

    return (
        <>
            <div className="space-y-6 overflow-x-hidden">
                <div className="grid grid-cols-5 gap-4 items-stretch">
                    <div className="col-span-3">
                        {clsInfo && (
                            <ClassInfoCard
                                classInfo={clsInfo}
                                mutateClass={mutateClass}
                            />
                        )}
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                        <StatsCard
                            title="Active Enrollments"
                            number={enrollmentCount}
                            label={
                                enrollmentCount === '1'
                                    ? 'Resident'
                                    : 'Residents'
                            }
                            tooltip="Number of residents currently enrolled in this class. Does not include residents who completed, did not complete, or were transferred."
                            tooltipClassName="tooltip-bottom"
                        />
                        <StatsCard
                            title="Missing Attendance"
                            number={
                                clsLoader.missing_attendance?.toString() ?? '0'
                            }
                            label={
                                clsLoader.missing_attendance === 1
                                    ? 'Session'
                                    : 'Sessions'
                            }
                            tooltip="Number of class sessions that have occurred but do not have any attendance records."
                            tooltipClassName="tooltip-left"
                        />
                        <StatsCard
                            title="Attendance Rate"
                            number={getAttendanceRate()}
                            label="%"
                            tooltip="Percentage of attendance records marked present for this class, calculated across all sessions where attendance is taken."
                        />
                        <StatsCard
                            title="Completion Rate"
                            number={getCompletionRate()}
                            label="%"
                            tooltip="Percentage of enrolled residents who completed this class over all time."
                            tooltipClassName="tooltip-left"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-6 items-stretch">
                    <div className="col-span-1">
                        <ActivityHistoryCard classInfo={clsInfo} />
                    </div>
                    <div className="col-span-2 h-full">
                        <div className="card card-row-padding flex flex-col gap-2 grow  h-full">
                            <h1>Needs Attention</h1>
                            <p className="body italic">
                                These flags highlight residents with attendance
                                patterns that may need follow-up:
                            </p>
                            <p className="body italic">
                                No attendance yet &ndash; Resident is enrolled
                                but has not attended any sessions since the
                                class began.
                            </p>
                            <p className="body italic">
                                Multiple absences &ndash; Resident has missed 3
                                or more class sessions with unexcused absences
                                after attending at least once.
                            </p>
                            <table className="table w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className="body text-grey-4 font-medium w-[30%] text-left truncate">
                                            Resident Name
                                        </th>
                                        <th className="text-center body text-grey-4 font-medium w-[40%]">
                                            Resident ID
                                        </th>
                                        <th className="text-left body text-grey-4 font-medium w-[30%]">
                                            Flag
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flags?.data.map(
                                        (
                                            item: AttendanceFlag,
                                            index: number
                                        ) => (
                                            <tr key={index}>
                                                <td className="body-small text-left">
                                                    {item.name_last},{' '}
                                                    {item.name_first}
                                                </td>
                                                <td className="body-small text-center">
                                                    {item.doc_id}
                                                </td>
                                                <td className="body-small text-left">
                                                    {item.flag_type ===
                                                    AttendanceFlagType.NoAttendance
                                                        ? 'no attendance yet'
                                                        : 'multiple abscences'}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                            {flagsError && (
                                <span className="text-center text-error">
                                    Failed to load attendance warnings
                                </span>
                            )}
                            {!flagsError && flags?.data.length === 0 && (
                                <span className="text-center text-warning">
                                    No attendance flags found
                                </span>
                            )}
                            {!flagsError && flags && flags?.data.length > 0 && (
                                <div className="flex justify-center">
                                    {flags?.meta && (
                                        <Pagination
                                            meta={flags.meta}
                                            setPage={setPage}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
