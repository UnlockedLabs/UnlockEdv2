import {
    ResidentProgramClassHistory,
    ResidentProgramClassInfo,
    ServerResponseMany
} from '@/common';
import GreyPill from '@/Components/pill-labels/GreyPill';
import { useAuth } from '@/useAuth';
import useSWR from 'swr';

export default function ResidentOverview() {
    // TODO: for testing purposes
    const { user } = useAuth();
    const user_id = user?.id;
    const page = 1;
    const perPage = 10;
    // TODO: Programs is currently paginated and this should be removed
    const {
        data: programsResp
        // error: programsError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassInfo>, Error>(
        `/api/users/${user_id}/programs?page=${page}&per_page=${perPage}`
    );
    const enrollment_metrics = programsResp?.data;

    const {
        data: weekly_scheduleResp
        // error: weekly_scheduleError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassInfo>, Error>(
        `/api/users/${user_id}/weekly-schedule`
    );
    if (!weekly_scheduleResp) {
        return <div>Loading...</div>;
    }
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
            <div className="flex">
                <span className="mr-1">Program:</span>
                Parenting
            </div>
            {/* TODO: Remove FAKE DATA and replace with actual data */}
            <div className="card card-row-padding mb-4">
                <div className="mb-2 flex justify-between">
                    <h2>Resume Writing</h2>
                    <GreyPill>Failed to Complete</GreyPill>
                </div>
                <div className="flex">Completion Credit</div>
                <div className="flex">Failed to complete on April 5, 2025</div>
            </div>
        </div>
    );
}
