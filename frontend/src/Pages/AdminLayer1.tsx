import {
    Library,
    OpenContentItem,
    ServerResponseMany,
    UserRole
} from '@/common';
import TopContentList from '@/Components/dashboard/TopContentList';
import DateRangePicker, {
    DateRangeValue,
    allTimeRange
} from '@/Components/inputs/DateRangePicker';
import { ExpandableCardGrid } from '@/Components/dashboard';
import LibraryCard from '@/Components/LibraryCard';
import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';

const buildLibrariesActivityQuery = (range: DateRangeValue) => {
    const params = new URLSearchParams({ per_page: '5' });
    if (range.allTime) {
        params.set('all_time', 'true');
    } else {
        params.set('start_date', range.startDate);
        params.set('end_date', range.endDate);
    }
    return `api/libraries/activity?${params.toString()}`;
};

export default function AdminLayer1() {
    const navigate = useNavigate();
    const { featured } = useLoaderData() as {
        featured: Library[];
    };
    const [dateRange, setDateRange] = useState<DateRangeValue>(allTimeRange);
    const { data: facilityLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>,
        Error
    >(buildLibrariesActivityQuery(dateRange));
    const { data: favoritedLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>,
        Error
    >(`api/libraries?order_by=most_popular&per_page=5`);
    function navigateToOpenContent() {
        navigate('/knowledge-center-management/libraries');
    }
    return (
        <div className="w-full flex flex-col gap-6 px-5 pb-4">
            <ExpandableCardGrid
                items={featured}
                title="Featured Content"
                emptyStateLink="/knowledge-center-management/libraries"
                emptyStateText="Feature content to showcase"
            >
                {(item) => (
                    <LibraryCard
                        library={item}
                        key={item.id}
                        role={UserRole.Student}
                    />
                )}
            </ExpandableCardGrid>

            <div className="flex flex-row justify-between items-end gap-4 flex-wrap">
                <h2>Insights</h2>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <TopContentList
                    heading="Top Facility Libraries"
                    items={facilityLibraries?.data ?? []}
                    navigateToOpenContent={navigateToOpenContent}
                />
                <TopContentList
                    heading="Top Favorited Libraries"
                    items={favoritedLibraries?.data ?? []}
                    navigateToOpenContent={navigateToOpenContent}
                />
            </div>
        </div>
    );
}
