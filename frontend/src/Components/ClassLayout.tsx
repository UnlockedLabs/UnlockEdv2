import {
    AttendanceFlag,
    AttendanceFlagType,
    Class,
    ClassLoaderData,
    EnrollmentStatus,
    ProgramClassEvent,
    ServerResponseMany,
    ServerResponseOne
} from '@/common';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import ClassStatus from './ClassStatus';
import useSWR from 'swr';
import { RRule } from 'rrule';
import ActivityHistoryCard from './ActivityHistoryCard';
import { useEffect, useState } from 'react';
import Pagination from './Pagination';
import ClampedText from './ClampedText';
import { useAuth } from '@/useAuth';
import StatsCard from './StatsCard';
import { isCompletedCancelledOrArchived } from '@/Pages/ProgramOverviewDashboard';

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

function ClassInfoCard({ classInfo }: { classInfo?: Class }) {
    const navigate = useNavigate();

    const programDisabled = classInfo?.program.archived_at !== null;
    const blockEdits = isCompletedCancelledOrArchived(
        classInfo ?? ({} as Class)
    );

    return (
        <div className="card card-row-padding flex flex-col h-full">
            <h1>Class Info</h1>
            <p className="body mb-1">Class Name: {classInfo?.name}</p>
            <ClampedText as="p" lines={4} className="body mb-1">
                Description: {classInfo?.description}
            </ClampedText>
            <p className="body mb-1">Class Status: {classInfo?.status}</p>
            <p className="body mt-5  mb-1">
                Instructor(s): {classInfo?.instructor_name}
            </p>
            <p className="body mb-1">
                Class Dates:{' '}
                {classInfo?.start_dt
                    ? new Date(classInfo?.start_dt).toLocaleDateString(
                          'en-US',
                          {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              timeZone: 'UTC'
                          }
                      )
                    : ''}{' '}
                &ndash;{' '}
                {(() => {
                    const classEndDate = getClassEndDate(
                        classInfo?.events ?? []
                    );
                    return classEndDate
                        ? classEndDate.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              timeZone: 'UTC'
                          })
                        : 'No end date scheduled';
                })()}
            </p>
            <p className="body">Room: {classInfo?.events[0].room}</p>
            <div
                className={`flex flex-row gap-2 mt-6 justify-center ${blockEdits ? 'tooltip' : ''} `}
                data-tip={
                    blockEdits
                        ? `This class is ${classInfo?.status.toLowerCase()} and cannot be modified.`
                        : ''
                }
            >
                <button
                    className="button"
                    onClick={() => {
                        navigate(
                            `/programs/${classInfo?.program_id}/classes/${classInfo?.id}`
                        );
                    }}
                    disabled={programDisabled || blockEdits}
                >
                    <PencilSquareIcon className="w-4 my-auto" />
                    Edit Class Details
                </button>
            </div>
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

    function getNextOccurrenceDateAsStr(): string {
        const now = new Date();
        const allOccurrences: Date[] = [];

        for (const event of clsInfo?.events ?? []) {
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
            ? formatDate(nextOccurrence)
            : 'No upcoming class found';
    }

    function formatDate(date: Date): string {
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: user?.timezone
        };
        return new Intl.DateTimeFormat('en-US', options)
            .format(date)
            .replace(',', '')
            .replace(',', ' @');
    }

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

    return (
        <>
            <div className="space-y-6 overflow-x-hidden">
                <div className="grid grid-cols-3 gap-6 items-stretch">
                    <div className="col-span-1">
                        <ClassInfoCard classInfo={clsInfo} />
                    </div>
                    <div className="col-span-2">
                        <div className="card card-row-padding grow">
                            <h1>Quick View</h1>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="card bg-base-teal p-4 pb-5 flex flex-col justify-between h-full overflow-visible">
                                    <div
                                        className={`flex items-center gap-1 justify-start`}
                                    >
                                        <h3 className="text-teal-4 line-clamp-2">
                                            Next Class:
                                        </h3>
                                    </div>
                                    <div className="flex flex-1 items-center justify-center">
                                        <p className="text-teal-3 text-lg font-bold text-center">
                                            <span className="text-teal-4 font-bold">
                                                {getNextOccurrenceDateAsStr()}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <StatsCard
                                    title="Enrolled"
                                    number={getEnrollmentCount()}
                                    label=" "
                                    tooltip="Number of residents currently enrolled in this class. Does not include residents who completed, did not complete, or were transferred."
                                    tooltipClassName="tooltip-left"
                                />
                                <StatsCard
                                    title="Attendance Rate"
                                    number={getAttendanceRate()}
                                    label="%"
                                    tooltip="Percentage of attendance records marked present for this class, calculated across all sessions where attendance is taken."
                                    tooltipClassName="tooltip-left"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-6 mt-5">
                                <div className="col-span-3 flex justify-center gap-6">
                                    <div className="w-full max-w-[calc((100%-2*1.5rem)/3)]">
                                        <div className="card bg-base-teal p-4 pb-5 flex flex-col justify-between h-full overflow-visible">
                                            <div
                                                className={`flex items-center gap-1 justify-start`}
                                            >
                                                <h3 className="text-teal-4 line-clamp-2">
                                                    Class Status
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-1 justify-center">
                                                {clsInfo && (
                                                    <ClassStatus
                                                        status={clsInfo.status}
                                                        program_class={clsInfo}
                                                        mutateClasses={
                                                            mutateClass
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full max-w-[calc((100%-2*1.5rem)/3)]">
                                        <StatsCard
                                            title="Completion Rate"
                                            number={getCompletionRate()}
                                            label="%"
                                            tooltip="Percentage of enrolled residents who completed this class over all time."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
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
