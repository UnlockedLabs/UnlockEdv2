import { useState } from 'react';
import useSWR from 'swr';
import {
    Video,
    ServerResponseMany,
    UserRole,
    videoIsAvailable
} from '../common';
import SearchBar from '../Components/inputs/SearchBar';
import DropdownControl from '../Components/inputs/DropdownControl';
import Pagination from '../Components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import { AxiosError } from 'axios';
import VideoCard from '@/Components/VideoCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useLocation } from 'react-router-dom';

export default function VideoContent() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 300);
    const [perPage, setPerPage] = useState(12);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const route = useLocation();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        AxiosError
    >(
        `/api/videos?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&visibility=${adminWithStudentView() ? UserRole.Student : user?.role}`
    );

    const videoData =
        data?.data.filter(
            (vid) => videoIsAvailable(vid) && vid.visibility_status
        ) ?? [];
    const meta = data?.meta;
    if (!user) {
        return null;
    }
    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

    return (
        <>
            <div className="flex flex-row gap-4">
                <SearchBar
                    searchTerm={searchTerm}
                    changeCallback={handleChange}
                />
                <DropdownControl
                    label="Order by"
                    setState={setSortQuery}
                    enumType={{
                        'Title (A-Z)': 'title ASC',
                        'Title (Z-A)': 'title DESC',
                        'Date Added ↓': 'created_at DESC',
                        'Date Added ↑': 'created_at ASC',
                        Favorited: 'favorited'
                    }}
                />
            </div>
            <div className="grid grid-cols-4 gap-6">
                {videoData.map((video) => (
                    <VideoCard
                        key={video.id}
                        video={video}
                        mutate={mutate}
                        role={UserRole.Student}
                    />
                ))}
            </div>
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
            {error && (
                <span className="text-center text-error">
                    Failed to load videos.
                </span>
            )}
            {!isLoading && !error && videoData.length === 0 && (
                <span className="text-center text-warning">No results</span>
            )}
        </>
    );
}
