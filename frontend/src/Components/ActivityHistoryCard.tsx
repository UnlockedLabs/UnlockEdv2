import { useEffect, useState } from 'react';
import { ServerResponseMany, ActivityHistoryResponse, Class } from '@/common';
import useSWR from 'swr';
import Pagination from './Pagination';
import { ActivityHistoryRowCard } from './cards';
import AccountHistoryFilter from './AccountHistoryFilter';
import ProgramHistoryFilter from './ProgramHistoryFilter';
import ClassHistoryFilter from './ClassHistoryFilter';

export default function ActivityHistoryCard({
    programId,
    classInfo,
    residentId
}: {
    programId?: string;
    residentId?: string;
    classInfo?: Class;
}) {
    const [page, setPage] = useState(1);
    const [filterQuery, setFilterQuery] = useState('');

    const endpoint = residentId
        ? `/api/users/${residentId}/account-history?page=${page}&per_page=5${filterQuery ? `&${filterQuery}` : ''}`
        : classInfo
          ? `/api/program-classes/${classInfo?.id}/history?page=${page}&per_page=10${filterQuery ? `&${filterQuery}` : ''}` //set to 10 due to larger card
          : programId
            ? `/api/programs/${programId}/history?page=${page}&per_page=5${filterQuery ? `&${filterQuery}` : ''}`
            : null;
    const {
        data: activityHistory,
        error: activityHistoryError,
        mutate: mutateHistory,
        isLoading
    } = useSWR<ServerResponseMany<ActivityHistoryResponse>, Error>(endpoint);

    useEffect(() => {
        if (classInfo) {
            void mutateHistory();
        }
    }, [classInfo?.status]);

    useEffect(() => {
        setPage(1);
    }, [filterQuery]);

    return (
        <div className="card card-row-padding flex flex-col h-full gap-2">
            {classInfo ? (
                <div className="flex items-center justify-between">
                    <h1>Class History</h1>
                    <ClassHistoryFilter onFilterChange={setFilterQuery} />
                </div>
            ) : programId ? (
                <div className="flex items-center justify-between">
                    <h2>Program History</h2>
                    <ProgramHistoryFilter onFilterChange={setFilterQuery} />
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <h2>Account Overview</h2>
                    <AccountHistoryFilter onFilterChange={setFilterQuery} />
                </div>
            )}
            {isLoading && <div>Loading...</div>}
            {activityHistoryError && (
                <p className="body text-error">
                    {classInfo
                        ? 'Unable to retrieve class history'
                        : 'Unable to retrieve account history'}
                </p>
            )}
            {!isLoading &&
                !activityHistoryError &&
                activityHistory != undefined && (
                    <>
                        <div className="flex-grow">
                            {activityHistory?.data.map(
                                (item: ActivityHistoryResponse, index) => (
                                    <ActivityHistoryRowCard
                                        key={index}
                                        activity={item}
                                    />
                                )
                            )}
                        </div>
                        <div className="mx-auto">
                            <Pagination
                                meta={activityHistory?.meta}
                                setPage={setPage}
                            />
                        </div>
                    </>
                )}
        </div>
    );
}
