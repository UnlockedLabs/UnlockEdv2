import useSWR from 'swr';
import {
    OpenContentResponse,
    ResidentEngagementProfile,
    ServerResponseMany,
    ServerResponseOne,
    UserAccountHistoryResponse,
    ValidResident
} from '@/common';
import EngagementRateGraph from '@/Components/EngagementRateGraph';
import { ResponsiveContainer } from 'recharts';
import StatsCard from '@/Components/StatsCard';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';
import OpenContentCardRow from '@/Components/cards/OpenContentCard';
import Pagination from '@/Components/Pagination';
import {
    closeModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { useRef, useState } from 'react';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { VerifyResidentModal } from '@/Components/modals/VerifyResidentModal';
import API from '@/api/api';
import { canSwitchFacility, useAuth } from '@/useAuth';
import TransferSummaryPanel from '@/Components/TransferSummaryPanel';
import { AccountHistoryRowCard } from '@/Components/cards';
import calculateEngagementMetrics from '@/Components/helperFunctions/calculateEngagementMetrics';
import ResidentPrograms from '@/Components/ResidentPrograms';

function UserProfileInfoRow({
    column,
    value
}: {
    column: string;
    value: string;
}) {
    return (
        <div className="grid grid-cols-2">
            <p className="body text-right">{column}</p>
            <div className="flex">
                <p className="body">:</p>
                <p className="body pl-3">{value}</p>
            </div>
        </div>
    );
}

function OpenContentCardToggle({
    activeTab,
    setActiveTab
}: {
    activeTab: 'libraries' | 'videos';
    setActiveTab: React.Dispatch<React.SetStateAction<'libraries' | 'videos'>>;
}) {
    const activeTabStyle = '!font-bold text-teal-4';
    return (
        <div className="flex flex-row gap-4">
            <h2
                className={`cursor-pointer font-normal ${activeTab === 'libraries' ? activeTabStyle : ''}`}
                onClick={() => setActiveTab('libraries')}
            >
                Top Viewed Libraries
            </h2>
            <span>|</span>
            <h2
                className={`cursor-pointer font-normal ${activeTab === 'videos' ? activeTabStyle : ''}`}
                onClick={() => setActiveTab('videos')}
            >
                Recently Viewed Videos
            </h2>
        </div>
    );
}

const ResidentProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { user_id: residentId } = useParams<{ user_id: string }>();
    const {
        data,
        error,
        mutate: mutateResident,
        isLoading
    } = useSWR<ServerResponseOne<ResidentEngagementProfile>, Error>(
        `/api/users/${residentId}/profile`
    );
    if (error?.message === 'Not Found') {
        navigate('/404');
    } else if (error) {
        navigate('/error');
    }
    const [resident, setResident] = useState<ValidResident | null>();
    const metrics = data?.data;
    const [page, setPage] = useState(1);
    const { data: activityHistory, error: activityHistoryError } = useSWR<
        ServerResponseMany<UserAccountHistoryResponse>,
        Error
    >(`/api/users/${residentId}/account-history?page=${page}&per_page=5`);

    const [activeTab, setActiveTab] = useState<'libraries' | 'videos'>(
        'libraries'
    );

    const { avgNumber, weekNumber, avgLabel, weekLabel } =
        calculateEngagementMetrics(metrics);

    const handleShowLibraryClick = (id: number) => {
        navigate(`/viewer/libraries/${id}`);
    };

    //start transfer logic
    const verifyResidentModal = useRef<HTMLDialogElement>(null);
    const confirmTransferModal = useRef<HTMLDialogElement>(null);
    const checkResponse = useCheckResponse({
        mutate: mutateResident,
        refModal: confirmTransferModal
    });
    function openConfirmTransfer(user: ValidResident) {
        setResident(user);
        showModal(confirmTransferModal);
    }
    async function transferResident() {
        const response = await API.patch(`users/resident-transfer`, {
            trans_facility_id: resident?.trans_facility_id,
            user_id: resident?.user.id,
            curr_facility_id: resident?.user.facility_id
        });
        checkResponse(
            response.success,
            'Unable to transfer resident',
            'Transferred resident successfully'
        );
        if (response.success) {
            const resp = await API.put<null, object>(
                `admin/facility-context/${resident?.trans_facility_id}`,
                {}
            );
            if (resp.success) {
                window.location.reload();
            }
        }
    }
    //end transfer logic
    return (
        <div className="overflow-x-hidden px-5 pb-4">
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <div className="space-y-6">
                    <div className="flex flex-row gap-6">
                        <div className="card card-row-padding flex flex-col justify-center">
                            <div className="justify-items-center">
                                <UserCircleIcon className="w-24" />
                            </div>
                            <h1 className="text-center mb-2">
                                {metrics?.user.name_first}{' '}
                                {metrics?.user.name_last}
                            </h1>
                            <UserProfileInfoRow
                                column="Username"
                                value={metrics.user.username}
                            />
                            <UserProfileInfoRow
                                column="DOC ID"
                                value={metrics.user.doc_id ?? 'N/a'}
                            />
                            <UserProfileInfoRow
                                column="Joined"
                                value={
                                    metrics?.user.created_at
                                        ? new Date(
                                              metrics.activity_engagement.joined
                                          ).toLocaleDateString('en-US', {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric'
                                          })
                                        : 'No Date Available'
                                }
                            />
                            <UserProfileInfoRow
                                column="Last Active"
                                value={
                                    metrics.activity_engagement.last_active_date
                                        ? new Date().toLocaleDateString(
                                              'en-US',
                                              {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric'
                                              }
                                          )
                                        : 'N/A'
                                }
                            />
                            <div className="flex flex-row gap-2 mt-4 justify-center">
                                <button className="button bg-grey-1 text-error">
                                    Delete Resident
                                </button>
                                {user && canSwitchFacility(user) && (
                                    <button
                                        className="button bg-grey-1 text-teal-4"
                                        onClick={() =>
                                            showModal(verifyResidentModal)
                                        }
                                    >
                                        Transfer Resident
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Chart */}
                        <div className="card card-row-padding grow">
                            <h2>
                                {metrics?.user.name_first +
                                    "'s Recent Activity"}
                            </h2>
                            <ResponsiveContainer>
                                <EngagementRateGraph
                                    data={metrics?.session_engagement ?? []}
                                    viewType="userEngagement"
                                />
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* Cards */}
                    <div className="grid grid-cols-3 gap-6">
                        <StatsCard
                            title="Days Active"
                            number={metrics.activity_engagement.total_active_days_monthly.toFixed(
                                0
                            )}
                            label="Days"
                            tooltip="Total days active in UnlockEd"
                            useToLocaleString={false}
                        />
                        <StatsCard
                            title="Avg Time Per Week"
                            number={
                                parseFloat(avgNumber) === 0
                                    ? '0'
                                    : parseFloat(avgNumber) < 1
                                      ? '<1'
                                      : avgNumber
                            }
                            label={avgLabel}
                            tooltip="Average time spent in UnlockEd per week"
                            useToLocaleString={false}
                        />
                        <StatsCard
                            title="Total Time This Week"
                            number={
                                parseFloat(weekNumber) === 0
                                    ? '0'
                                    : parseFloat(weekNumber) < 1
                                      ? '<1'
                                      : weekNumber
                            }
                            label={weekLabel}
                            tooltip="Total time spent in UnlockEd this week"
                        />
                    </div>
                    {/* Tables */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="card card-row-padding col-span-2 w-full">
                            <ResidentPrograms
                                user_id={residentId ? residentId : ''}
                            />
                        </div>
                        <div className="card card-row-padding flex flex-col gap-2">
                            <h2>Account Overview</h2>
                            {activityHistoryError ||
                            activityHistory === undefined ? (
                                <p className="body text-error">
                                    Unable to retrieve account history
                                </p>
                            ) : (
                                <>
                                    <div className="flex-grow">
                                        {activityHistory?.data.map(
                                            (
                                                item: UserAccountHistoryResponse,
                                                index
                                            ) => (
                                                <AccountHistoryRowCard
                                                    key={
                                                        index +
                                                        item.created_at.toString()
                                                    }
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
                        <div className="card card-row-padding">
                            <OpenContentCardToggle
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                            {activeTab === 'libraries' ? (
                                <>
                                    <table className="table-2 mb-4">
                                        <thead>
                                            <tr className="grid-col-2">
                                                <th className="justify-self-start">
                                                    Library Name
                                                </th>
                                                <th># Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.top_libraries.map(
                                                (
                                                    items: OpenContentResponse
                                                ) => {
                                                    return (
                                                        <tr
                                                            className="justify-items-center cursor-pointer"
                                                            key={
                                                                items.content_id
                                                            }
                                                            onClick={() =>
                                                                handleShowLibraryClick(
                                                                    items.content_id
                                                                )
                                                            }
                                                        >
                                                            <td className="justify-self-start">
                                                                {items.is_featured
                                                                    ? `${
                                                                          items.title ??
                                                                          'Untitled'
                                                                      } *`
                                                                    : items.title ??
                                                                      'Untitled'}
                                                            </td>
                                                            <td className="justify-self-end">
                                                                {items.total_hours.toFixed(
                                                                    2
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="border-t border-grey-1 mt-2"></div>
                                    <p className="text-xs text-grey-4 italic">
                                        * Featured library
                                    </p>
                                </>
                            ) : (
                                <div className="mt-2">
                                    {metrics.recent_videos.length > 0 ? (
                                        metrics.recent_videos.map(
                                            (item, index) => {
                                                return (
                                                    <OpenContentCardRow
                                                        key={index}
                                                        content={item}
                                                    />
                                                );
                                            }
                                        )
                                    ) : (
                                        <div className="body">
                                            No videos to display
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <VerifyResidentModal
                target={metrics}
                onSuccess={openConfirmTransfer}
                ref={verifyResidentModal}
                mutate={mutateResident}
            />
            <TextOnlyModal
                ref={confirmTransferModal}
                type={TextModalType.Confirm}
                width="max-w-2xl"
                title={'Confirm Transfer'}
                text={resident && <TransferSummaryPanel resident={resident} />}
                onSubmit={() => void transferResident()}
                onClose={() => {
                    closeModal(confirmTransferModal);
                    setResident(null);
                }}
            />
        </div>
    );
};

export default ResidentProfile;
