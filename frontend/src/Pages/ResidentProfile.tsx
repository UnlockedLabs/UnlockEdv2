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
import ClampedText from '@/Components/ClampedText';

const ResidentProfile = () => {
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
                                    <UserCircleIcon className="w-[80px] h-[80px]" />
                                </div>
                                <div className="mt-auto">
                                    <div className="text-2xl text-center">
                                        {metrics?.user.name_first}{' '}
                                        {metrics?.user.name_last}
                                    </div>
                                    <div className="text-base">
                                        <div className="grid grid-cols-2">
                                            <p>Username</p>
                                            <div className="flex flex-row justify-between">
                                                <p>:</p>
                                                {metrics.user.username}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p>Joined</p>
                                            <div className="flex flex-row justify-between">
                                                <p>:</p>
                                                {metrics?.user.created_at
                                                    ? new Date(
                                                          metrics.activity_engagement.joined
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
                                                {metrics.activity_engagement
                                                    .last_active_date
                                                    ? new Date().toLocaleDateString(
                                                          'en-US',
                                                          {
                                                              year: 'numeric',
                                                              month: 'short',
                                                              day: 'numeric'
                                                          }
                                                      )
                                                    : 'N/A'}
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
                                    {metrics?.user.name_first +
                                        "'s Recent Activity"}
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
                                                    metrics?.session_engagement ??
                                                    []
                                                }
                                                viewType="userEngagement"
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
                            <div className="border-t border-grey-300 mt-2"></div>
                            <p className="text-xs text-grey-4 italic">
                                * Featured library
                            </p>
                        </div>
                        {/* <div></div> */}
                        <div className="card pt-2 px-3">
                            <div className="text-teal-4 text-center text-lg font-semibold border-b border-b-grey-300">
                                Recently Watched Videos
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
                                {metrics.recent_videos.length > 0 ? (
                                    metrics.recent_videos.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex flex-col items-center"
                                        >
                                            <img
                                                className="h-8 object-contain"
                                                src={item.thumbnail_url ?? ''}
                                                alt={item.title ?? 'Untitled'}
                                            />
                                            <ClampedText
                                                className="text-xs"
                                                as={'span'}
                                                lines={2}
                                            >
                                                {item.title ?? 'Untitled'}
                                            </ClampedText>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center">
                                        No Videos Found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ResidentProfile;
