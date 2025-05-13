import {
    EnrollmentStatus,
    ProgClassStatus,
    ResidentProgramOverview,
    ServerResponseMany,
    ServerResponseOne,
    StudentCalendarResponse
} from '@/common';
import GreyPill from '@/Components/pill-labels/GreyPill';
import WeeklyScheduleTable from '@/Components/WeeklyScheduleTable';
import { useAuth } from '@/useAuth';
import useSWR from 'swr';
type ProgramInfoMap = Record<string, ResidentProgramOverview[]>;

export default function ResidentOverview() {
    const { user } = useAuth();
    const user_id = user?.id;
    const { data: programsResp } = useSWR<
        ServerResponseMany<ResidentProgramOverview>,
        Error
    >(
        `/api/users/${user_id}/programs?view=overview&order=ASC&order_by=program_name&all=false`
    );
    const programData = programsResp?.data;

    const programDataMap: ProgramInfoMap = {};
    if (programData) {
        programDataMap.enrollment_metrics = programData.filter(
            (item) =>
                item.status === ProgClassStatus.ACTIVE ||
                item.status === ProgClassStatus.SCHEDULED
        );
        programDataMap.activity_metrics = programData.filter(
            (item) =>
                item.enrollment_status === EnrollmentStatus.Completed ||
                item.enrollment_status ===
                    EnrollmentStatus['Failed To Complete']
        );
    }
    const enrollment_metrics = programDataMap.enrollment_metrics?.sort(
        (a, b) => {
            if (a.program_name < b.program_name) {
                return -1;
            }
            if (a.program_name > b.program_name) {
                return 1;
            }
            return 0;
        }
    );
    const activity_metrics = programDataMap.activity_data?.sort((a, b) => {
        if (a.updated_at < b.updated_at) {
            return 1;
        }
        if (a.updated_at > b.updated_at) {
            return -1;
        }
        return 0;
    });
    const { data: scheduleResp } = useSWR<
        ServerResponseOne<StudentCalendarResponse>,
        Error
    >(`/api/student-calendar`);
    const weekly_schedule_metrics = scheduleResp?.data;

    function formatDate(dateString: string): string {
        if (!dateString) return '';
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return date.toLocaleDateString('en-US', options);
    }
    return (
        <div className="px-5">
            {enrollment_metrics && enrollment_metrics?.length > 0 ? (
                <div>
                    {enrollment_metrics.map((program) => (
                        <div className="card card-row-padding mb-4">
                            <div className="mb-2 flex justify-between">
                                <h2>{program.program_name}</h2>
                                <GreyPill>{program.status}</GreyPill>
                            </div>
                            <div>
                                <div className="flex">
                                    <span className="mr-1">Program:</span>
                                    {program.class_name}
                                </div>
                                <div className="flex">
                                    <span className="mr-1">Credit Types:</span>
                                    {program.credit_types}
                                </div>
                                {program.status.toString() === 'Scheduled' && (
                                    <>
                                        <div className="flex">
                                            <span className="mr-1">
                                                Start Date:
                                            </span>
                                            {formatDate(program.start_date)}
                                        </div>
                                        <div className="flex">
                                            <span className="mr-1">
                                                Date Updated:
                                            </span>
                                            {formatDate(program.updated_at)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="body">
                    You are not currently enrolled in any programs.
                </p>
            )}
            <div className="card card-row-padding mb-4">
                <div className="mb-2 flex justify-between">
                    <h1>Weekly Schedule</h1>
                </div>
                {weekly_schedule_metrics &&
                weekly_schedule_metrics?.days.length > 0 ? (
                    <WeeklyScheduleTable
                        days={weekly_schedule_metrics.days ?? []}
                    />
                ) : (
                    <p className="body">No classes scheduled for this week.</p>
                )}
            </div>
            <div className="mb-4 flex gap-1">
                <h1
                    className="tooltip"
                    data-tip="Tracking history only for programs in UnlockEd."
                >
                    Program History
                </h1>
                ⓘ
            </div>
            {activity_metrics && activity_metrics?.length > 0 ? (
                activity_metrics.map((program) => (
                    <>
                        <div className="flex">
                            <span className="mr-1">Program:</span>
                            {program.program_name}
                        </div>
                        <div className="card card-row-padding mb-4">
                            <div className="mb-2 flex justify-between">
                                <h2>{program.class_name}</h2>
                                <GreyPill>{program.status}</GreyPill>
                            </div>
                            <div className="flex">{program.status}</div>
                            <div className="flex">
                                {program.status}
                                {' on '}
                                {formatDate(program.updated_at)}
                            </div>
                        </div>
                    </>
                ))
            ) : (
                <p className="body">
                    No program participation history available.
                </p>
            )}
        </div>
    );
}
