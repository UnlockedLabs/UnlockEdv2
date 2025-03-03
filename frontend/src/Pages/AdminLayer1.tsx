import {
    FilterPastTime,
    Library,
    OpenContentItem,
    ServerResponseMany,
    UserRole
} from '@/common';
import TopContentList from '@/Components/dashboard/TopContentList';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { ExpandableCardGrid } from '@/Components/dashboard';
import LibraryCard from '@/Components/LibraryCard';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';

export default function AdminLayer1() {
    const navigate = useNavigate();
    const { featured } = useLoaderData() as {
        featured: Library[];
    };
    const [timeFilter, setTimeFilter] = useState('7');
    const { data: facilityLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>,
        AxiosError
    >(`api/libraries/activity?days=${timeFilter}&per_page=5`);
    const { data: favoritedLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>,
        AxiosError
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

            <div className="flex flex-row justify-between items-center">
                <h2>Insights</h2>
                <DropdownControl
                    enumType={FilterPastTime}
                    setState={setTimeFilter}
                />
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
