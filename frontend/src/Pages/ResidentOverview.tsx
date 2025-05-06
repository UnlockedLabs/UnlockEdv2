import {
    ResidentProgramClassHistory,
    ResidentProgramClassInfo,
    ResidentProgramClassWeeklySchedule,
    ServerResponseMany
} from '@/common';
import GreyPill from '@/Components/pill-labels/GreyPill';
import { useAuth } from '@/useAuth';
import useSWR from 'swr';

export default function ResidentOverview() {
    const { user } = useAuth();
    const user_id = user?.id;
    const {
        data: programsResp
        // error: programsError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassInfo>, Error>(
        `/api/users/${user_id}/programs`
    );
    const enrollment_metrics = programsResp?.data;

    const {
        data: weekly_scheduleResp
        // error: weekly_scheduleError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassWeeklySchedule>, Error>(
        `/api/users/${user_id}/weekly-schedule`
    );
    const weekly_schedule_metrics = weekly_scheduleResp?.data;
    console.log('weekly_schedule_metrics:>>   ', weekly_schedule_metrics);

    const {
        data: historyResp
        // error: historyError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassHistory>, Error>(
        `/api/users/${user_id}/program-history`
    );
    const history_metrics = historyResp?.data;
    console.log('history_metrics:>>   ', history_metrics);
    function formatDate(dateString: string): string {
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
                    {programsResp.data.map((program) => (
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
                                    <div className="flex">
                                        <span className="mr-1">
                                            Start Date:
                                        </span>
                                        {formatDate(program.start_date)}
                                    </div>
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
            {/* TODO: Weekly Schedule */}
            {weekly_schedule_metrics && weekly_schedule_metrics.length > 0 ? (
                <div>
                    {weekly_schedule_metrics.map((schedule, index) => (
                        <div key={index} className="flex">
                            <span className="mr-1">Class Name:</span>
                            {schedule.class_name}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="body">No classes scheduled for this week.</p>
            )}
            <div className="card card-row-padding mb-4">
                <div className="mb-2 flex justify-between">
                    <h1>Weekly Schedule</h1>
                </div>
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
            {history_metrics && history_metrics?.length > 0 ? (
                history_metrics.map((program) => (
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
                            <div className="flex">{program.credit_types}</div>
                            <div className="flex">
                                {program.status}
                                {' on '}
                                {program.date_status_changed}
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
