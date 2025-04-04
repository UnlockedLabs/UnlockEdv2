import useSWR from 'swr';
import { AxiosError } from 'axios';
import {
    OpenContentResponse,
    ResidentEngagementProfile,
    ServerResponseMany,
    ServerResponseOne,
    UserAccountHistoryResponse
} from '@/common';
import EngagementRateGraph from '@/Components/EngagementRateGraph';
import { ResponsiveContainer } from 'recharts';
import StatsCard from '@/Components/StatsCard';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';
import OpenContentCardRow from '@/Components/cards/OpenContentCard';
import { useState } from 'react';
import Pagination from '@/Components/Pagination';

function UserProfileInfoRow({
    column,
    value
}: {
    column: string;
    value: string;
}) {
    return (
        <div className="grid grid-cols-2">
            <p className="body">{column}</p>
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
    const activeTabStyle = 'font-bold text-teal-4';
    return (
        <div className="flex flex-row gap-4">
            <h2
                className={`cursor-pointer ${activeTab === 'libraries' ? activeTabStyle : ''}`}
                onClick={() => setActiveTab('libraries')}
            >
                Top Viewed Libraries
            </h2>
            <span>|</span>
            <h2
                className={`cursor-pointer ${activeTab === 'videos' ? activeTabStyle : ''}`}
                onClick={() => setActiveTab('videos')}
            >
                Recently Viewed Videos
            </h2>
        </div>
    );
}

function AccountHistoryRowCard({
    activity
}: {
    activity: UserAccountHistoryResponse;
}) {
    let introText;
    switch (activity.action) {
        case 'account_creation':
            introText = 'Account created by ' + activity.admin_username;
            break;
        case 'facility_transfer':
            introText =
                'Account assigned to ' +
                activity.facility_name +
                ' by ' +
                activity.admin_username;
            break;
        case 'set_password':
            introText = 'New password set by ' + activity.user_username;
            break;
        case 'reset_password':
            introText =
                'Password reset initiated by ' + activity.admin_username;
            break;
    }
    if (!introText) return;
    return (
        <p className="body">
            {introText} (
            {new Date(activity.created_at).toLocaleDateString('en-US')})
        </p>
    );
}

const ResidentProfile = () => {
    const { user_id } = useParams<{ user_id: string }>();
    const { data, error, isLoading } = useSWR<
        ServerResponseOne<ResidentEngagementProfile>,
        AxiosError
    >(`/api/users/${user_id}/profile`);
    const metrics = data?.data;
    const [page, setPage] = useState(1);
    const { data: activityHistory, error: activityHistoryError } = useSWR<
        ServerResponseMany<UserAccountHistoryResponse>,
        AxiosError
    >(`/api/user-account-history/${user_id}?page=${page}&per_page=5`);

    const [activeTab, setActiveTab] = useState<'libraries' | 'videos'>(
        'libraries'
    );
    const isLessAvgThanOneHour =
        (metrics?.activity_engagement.total_hours_active_weekly ?? 0) < 1;
    const isLessThanOneHour =
        (metrics?.activity_engagement.total_hours_engaged ?? 0) < 1;

    const avgNumber = isLessAvgThanOneHour
        ? (
              metrics?.activity_engagement.total_minutes_active_weekly ?? 0
          ).toFixed(2)
        : (metrics?.activity_engagement.total_hours_active_weekly ?? 0).toFixed(
              2
          );

    const weekNumber = isLessThanOneHour
        ? (metrics?.activity_engagement.total_minutes_engaged ?? 0).toFixed(2)
        : (metrics?.activity_engagement.total_hours_engaged ?? 0).toFixed(2);

    const avgLabel = isLessAvgThanOneHour ? 'Min' : 'Hrs';

    const weekLabel = isLessThanOneHour ? 'Minutes' : 'Hours';

    const navigate = useNavigate();
    const handleShowLibraryClick = (id: number) => {
        navigate(`/viewer/libraries/${id}`);
    };

    return (
        <div className="overflow-x-hidden px-5 pb-4">
            {error && <div>Error loading data</div>}
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
                        <div className="card card-row-padding space-y-2">
                            <h2>Account Overview</h2>
                            {activityHistoryError ||
                            activityHistory === undefined ? (
                                <p className="body text-error">
                                    Unable to retrieve account history
                                </p>
                            ) : (
                                <>
                                    <div>
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
                                    <div className="flex mx-auto">
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
        </div>
    );
};

export default ResidentProfile;
