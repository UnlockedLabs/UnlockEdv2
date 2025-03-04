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
import { useParams } from 'react-router-dom';
import ClampedText from '@/Components/ClampedText';

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

    const weekNumber = isLessThanOneHour ? (metrics?.activity_engagement.total_minutes_engaged ?? 0).toFixed(2) :
        (metrics?.activity_engagement.total_hours_engaged ?? 0).toFixed(2);
  
    const avgLabel = isLessAvgThanOneHour
        ? 'AVG Minutes PER Week'
        : 'AVG Hours PER Week';

        const weekLabel = isLessThanOneHour
        ? 'Total Minutes This Week'
        : 'Total Hours This Week';

    const avgToolTip = isLessAvgThanOneHour
        ? 'Average number of minutes resident is logged in to UnlockedEd'
        : 'Average number of hours resident is logged in to UnlockedEd';

        const weekToolTip = isLessThanOneHour
        ? 'Total number of minutes resident was logged in to UnlockedEd this week'
        : 'Total number of hours resident was logged in to UnlockedEd this week';

    return (
        <div className="overflow-x-hidden px-5 pb-4">
            {error && <div>Error loading data</div>}
            {!data || (isLoading && <div>Loading...</div>)}
            {data && metrics && (
                <>
                    <div className="flex flex-row gap-6 items-stretch">
                        <div className="w-[270px] h-[240px] flex flex-col gap-4">
                            <div className="card card-row-padding overflow-hidden text-med text-teal-4 flex-1 h-full">
                                <div className="justify-items-center">
                                    <UserCircleIcon className="w-[64px] h-[64px]" />
                                </div>
                                <div className="">
                                    <div className="text-md mt-2">
                                        {
                                            metrics?.session_engagement
                                                .user_info.name_first
                                        }{' '}
                                        {
                                            metrics?.session_engagement
                                                .user_info.name_last
                                        }
                                    </div>
                                    <div className="text-sm mt-2">
                                        <span className="font-semibold  justify-self-start">
                                            Username
                                        </span>
                                        {' : '}
                                        {
                                            metrics?.session_engagement
                                                .user_info.username
                                        }
                                    </div>
                                    <div className="text-sm mt-2">
                                        <span className="font-semibold">
                                            Joined :
                                        </span>{' '}
                                        {new Date(
                                            metrics.activity_engagement.first_active_date
                                        ).toLocaleDateString('en-US')}
                                    </div>
                                    <div className="text-sm mt-2">
                                        <span className="font-semibold">
                                            Last Active :
                                        </span>{' '}
                                        {new Date(
                                            metrics.activity_engagement.last_active_date
                                        ).toLocaleDateString('en-US')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Chart */}
                        <div className="flex-1 h-[240px] flex flex-col gap-4">
                            <div className="card card-row-padding overflow-hidden">
                                <h1 className="">
                                    {' '}
                                    {/* {metrics?.session_engagement.user_info.name_first +
                                        " 's recent Activity"} */}
                                </h1>
                                <div className=" items-stretch">
                                    <div className="h-[240px] overflow-visible">
                                        <ResponsiveContainer
                                            className="h-full p-7"
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
                            label="Days Active This Month"
                            tooltip="Total number of days resident has been active in UnlockedEd"
                            useToLocaleString={false}
                        />
                        <StatsCard
                            title="Average Activity Time"
                            number={avgNumber}
                            label={avgLabel}
                            tooltip={avgToolTip}
                            useToLocaleString={false}
                        />
                        <StatsCard
                            title="Total Hours"
                            number={weekNumber}
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
                                    <tr className="grid-col-3">
                                        <th className="justify-self-start">
                                            Library Name
                                        </th>
                                        <th># Hours Watching</th>
                                        <th className="justify-self-end">
                                            Is Featured
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-4 mt-4">
                                    {metrics.top_libraries.map(
                                        (items: OpenContentResponse) => {
                                            return (
                                                <tr key={items.content_id}>
                                                    <td className="justify-self-start">
                                                        <img
                                                            className="h-8 mx-auto object-contain"
                                                            src={
                                                                items.thumbnail_url ??
                                                                ''
                                                            }
                                                        />
                                                        <ClampedText
                                                            as="h3"
                                                            lines={1}
                                                            className="my-auto w-full body font-normal text-left"
                                                        >
                                                            {items.title ??
                                                                'Untitled'}
                                                        </ClampedText>
                                                    </td>
                                                    <td>
                                                        {items.total_hours.toFixed(
                                                            2
                                                        )}
                                                    </td>
                                                    <td className="justify-self-end">
                                                        <input
                                                            name={'is_featured'}
                                                            type="checkbox"
                                                            className="checkbox"
                                                            checked={
                                                                items.is_featured
                                                            }
                                                            readOnly
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* <div></div> */}
                        <div className="card pt-2 px-3">
                            <div className="text-teal-4 text-center text-lg font-semibold">
                                Top 5 Recently Watched Videos
                            </div>
                            <table className="table-2 mb-4">
                                <thead>
                                    <tr className="grid-col-2">
                                        <th className="justify-self-end">
                                            Title
                                        </th>
                                        <th className="justify-self-start">
                                            Rank
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-4 mt-4">
                                    {metrics.recent_videos.length > 0 ? (
                                        metrics.recent_videos.map(
                                            (
                                                items: OpenContentResponse,
                                                index: number
                                            ) => {
                                                return (
                                                    <tr>
                                                        <td className="justify-self-end">
                                                            <img
                                                                className="h-8 mx-auto object-contain"
                                                                src={
                                                                    items.thumbnail_url ??
                                                                    ''
                                                                }
                                                            />
                                                        </td>
                                                        {items.title ??
                                                            'Untitled'}
                                                        <td className="justify-self-start">
                                                            {index + 1}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )
                                    ) : (
                                        <tr>
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
