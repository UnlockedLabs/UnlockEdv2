import useSWR from 'swr';
import { AxiosError } from 'axios';
import {
    OpenContentResponse,
    ResidentEngagementProfile,
    ServerResponseOne
} from '@/common';
import EngagementRateGraph from '@/Components/EngagementRateGraph';
import { ResponsiveContainer } from 'recharts';
import StatsCard from '@/Components/StatsCard';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';

const StudentProfile = () => {
    const { user_id } = useParams<{ user_id: string }>();
    const { data, error, isLoading } = useSWR<
        ServerResponseOne<ResidentEngagementProfile>,
        AxiosError
    >(`/api/users/${user_id}/profile`);
    const metrics = data?.data;

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

    const avgToolTip = isLessAvgThanOneHour
        ? 'Average minutes logged in to UnlockedEd'
        : 'Average hours logged in to UnlockedEd';

    const weekToolTip = isLessThanOneHour
        ? 'Total number of minutes resident was logged in to UnlockedEd this week'
        : 'Total number of hours resident was logged in to UnlockedEd this week';

    const navigate = useNavigate();
    const handleShowLibraryClick = (id: number) => {
        navigate(`/viewer/libraries/${id}`);
    };

    return (
        <div className="overflow-x-hidden px-5 pb-4">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <>
                    <div className="flex flex-row gap-6 items-stretch">
                        <div className="w-[300px] h-[240px] flex flex-col gap-4">
                            <div className="card p-4 overflow-hidden flex-1 h-full text-grey-4">
                                <div className="justify-items-center">
                                    <UserCircleIcon className="w-[64px] h-[64px]" />
                                </div>
                                <div className="">
                                    <div className="text-2xl text-center">
                                        {
                                            metrics?.session_engagement
                                                .user_info.name_first
                                        }{' '}
                                        {
                                            metrics?.session_engagement
                                                .user_info.name_last
                                        }
                                    </div>
                                    <div className="text -base">
                                        <div className="grid grid-cols-2">
                                            <p>Username</p>
                                            <div className="flex flex-row justify-between">
                                                <p>:</p>
                                                {
                                                    metrics?.session_engagement
                                                        .user_info.username
                                                }
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p>Joined</p>
                                            <div className="flex flex-row justify-between">
                                                <p>:</p>
                                                {metrics?.activity_engagement
                                                    ?.first_active_date
                                                    ? new Date(
                                                          metrics.activity_engagement.first_active_date
                                                      ).toLocaleDateString(
                                                          'en-US',
                                                          {
                                                              year: 'numeric',
                                                              month: 'short',
                                                              day: 'numeric'
                                                          }
                                                      )
                                                    : 'No Date Available'}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p>Last Active</p>
                                            <div className="flex flex-row justify-between">
                                                <p>:</p>
                                                {new Date(
                                                    metrics.activity_engagement.last_active_date
                                                ).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Chart */}
                        <div className="flex-1 h-[240px] flex flex-col gap-4">
                            <div className="card card-row-padding overflow-hidden">
                                <h1 className="">
                                    {metrics?.session_engagement.user_info
                                        .name_first + " 's recent Activity"}
                                </h1>
                                <div className=" items-stretch">
                                    <div className="w-full h-[240px] overflow-visible">
                                        <ResponsiveContainer
                                            className="w-full h-full overflow-visible pb-10"
                                            width="100%"
                                            height="100%"
                                            debounce={500}
                                        >
                                            <EngagementRateGraph
                                                data={
                                                    metrics?.session_engagement
                                                        ?.user_engagement_times ??
                                                    []
                                                }
                                                viewType="daily"
                                            />
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cards */}
                    <div className="w-[1/2] grid grid-cols-3 gap-4 mb-6 mt-6">
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
                            title="Avg Hours Per Week"
                            number={
                                parseFloat(avgNumber) === 0
                                    ? '0'
                                    : parseFloat(avgNumber) < 1
                                      ? '<1'
                                      : avgNumber
                            }
                            label={avgLabel}
                            tooltip={avgToolTip}
                            useToLocaleString={false}
                        />
                        <StatsCard
                            title="Total Hours This Week"
                            number={
                                parseFloat(weekNumber) === 0
                                    ? '0'
                                    : parseFloat(weekNumber) < 1
                                      ? '<1'
                                      : weekNumber
                            }
                            label={weekLabel}
                            tooltip={weekToolTip}
                        />
                    </div>
                    {/* Tables */}
                    <div className="grid grid-cols-2 gap-3 mb-6 mt-6">
                        <div className="card pt-2 px-3">
                            <div className="text-teal-4 text-center text-lg font-semibold">
                                Top 5 Most Viewed Libraries
                            </div>
                            <table className="table-2 mb-4">
                                <thead>
                                    <tr className="grid-col-2">
                                        <th className="justify-self-start">
                                            Library Name
                                        </th>
                                        <th># Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="">
                                    {metrics.top_libraries.map(
                                        (items: OpenContentResponse) => {
                                            return (
                                                <tr
                                                    className="justify-items-center cursor-pointer"
                                                    key={items.content_id}
                                                    onClick={() =>
                                                        handleShowLibraryClick(
                                                            items.content_id
                                                        )
                                                    }
                                                >
                                                    <td className="justify-self-start">
                                                        {items.is_featured
                                                            ? `* ${
                                                                  items.title ??
                                                                  'Untitled'
                                                              }`
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
                            <div className="border-t border-gray-300 mt-2"></div>
                            <p className="text-xs text-grey-4 italic">
                                * Data is based on recent video performance and
                                may not reflect all content.
                            </p>
                        </div>
                        {/* <div></div> */}
                        <div className="card pt-2 px-3">
                            <div className="text-teal-4 text-center text-lg font-semibold">
                                Top 5 Recently Watched Videos
                            </div>
                            <table className="table-2 mb-4">
                                <thead>
                                    <tr className="grid-col-2"></tr>
                                </thead>
                                <tbody className="grid-col-2">
                                    {metrics.recent_videos.length > 0 ? (
                                        metrics.recent_videos.map(
                                            (
                                                items: OpenContentResponse,
                                                index: number
                                            ) => {
                                                return (
                                                    <tr
                                                        className="justify-items-center"
                                                        key={index}
                                                    >
                                                        <td className="justify-self-end truncate w-full">
                                                            <img
                                                                className="h-8 mx-auto object-contain"
                                                                src={
                                                                    items.thumbnail_url ??
                                                                    ''
                                                                }
                                                            />
                                                            {items.title ??
                                                                'Untitled'}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )
                                    ) : (
                                        <tr className="justify-items-center">
                                            <td className="justify-self-start">
                                                No Videos Found
                                            </td>
                                            <td></td>
                                            <td className="justify-self-end"></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentProfile;
