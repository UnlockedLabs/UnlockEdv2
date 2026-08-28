import { useEffect } from 'react';
import useSWR from 'swr';
import { Video, ServerResponseMany, UserRole, ViewType } from '../common';
import Pagination from '../Components/Pagination';
import VideoCard from '@/Components/VideoCard';
import { useAuth } from '@/useAuth';
import { useOutletContext } from 'react-router-dom';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import LoadingSpinner from '@/Components/LoadingSpinner';

export default function VideoContent() {
    const { user } = useAuth();
    const { activeView, searchQuery, sortQuery } = useOutletContext<{
        activeView: ViewType;
        searchQuery: string;
        sortQuery: string;
    }>();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        Error
    >(
        `/api/videos?search=${searchQuery}&page=${pageQuery}&per_page=${perPage}&${sortQuery}&visibility=visible`
    );

    const videoData = data?.data ?? [];
    const meta = data?.meta;

    useEffect(() => {
        setPageQuery(1, { replace: true });
    }, [searchQuery, sortQuery]);

    if (!user) {
        return null;
    }

    return (
        <>
            {isLoading ? (
                <LoadingSpinner text="Loading videos..." centered />
            ) : (
                <div
                    className={`${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
                >
                    {videoData.map((video) => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            mutate={mutate}
                            role={UserRole.Student}
                            view={activeView}
                        />
                    ))}
                </div>
            )}
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
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
