import {
    FilterPastTime,
    Library,
    OpenContentItem,
    ServerResponseMany
} from '@/common';
import { FeaturedContent } from '@/Components/dashboard';
import TopContentList from '@/Components/dashboard/TopContentList';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
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
    >(`api/libraries?order_by=most_popular&per_page=5&days=${timeFilter}`);
    function navigateToOpenContent() {
        navigate('/knowledge-center-management/libraries');
    }
    useEffect(() => {
        console.log(timeFilter);
    }, [timeFilter]);
    return (
        <div className="w-full flex flex-col gap-6 px-5 pb-4">
            <FeaturedContent featured={featured} />
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
