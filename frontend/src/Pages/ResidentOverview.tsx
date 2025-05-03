import { ResidentProgramClassInfo, ServerResponseMany } from '@/common';
import GreyPill from '@/Components/pill-labels/GreyPill';
import { useAuth } from '@/useAuth';
import useSWR from 'swr';

export default function ResidentOverview() {
    // TODO: for testing purposes
    const { user } = useAuth();
    const user_id = user?.id;
    console.log(user_id, '>>>>>>>>>>>');
    const page = 1;
    const perPage = 10;
    //
    const {
        data: programsResp
        // error: programsError,
        // isLoading
    } = useSWR<ServerResponseMany<ResidentProgramClassInfo>, Error>(
        `/api/users/${user_id}/programs?page=${page}&per_page=${perPage}`
    );
    const enrollment_metrics = programsResp?.data;

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
                                    <span className="mr-1">Credit Type:</span>
                                    {program.credit_type}
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
