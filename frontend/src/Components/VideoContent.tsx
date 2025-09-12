import useSWR from 'swr';
import {
    Video,
    ServerResponseMany,
    UserRole,
    videoIsAvailable,
    ViewType
} from '../common';
import Pagination from '../Components/Pagination';
import VideoCard from '@/Components/VideoCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useLocation, useOutletContext } from 'react-router-dom';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import LoadingSpinner from '@/Components/LoadingSpinner';

export default function VideoContent() {
    const { user } = useAuth();
    const route = useLocation();
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

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        Error
    >(
        `/api/videos?search=${searchQuery}&page=${pageQuery}&per_page=${perPage}&${sortQuery}&visibility=${adminWithStudentView() ? UserRole.Student : user?.role}`
    );

    const videoData =
        data?.data.filter(
            (vid) => videoIsAvailable(vid) && vid.visibility_status
        ) ?? [];
    const meta = data?.meta;
    if (!user) {
        return null;
    }

    return (
        <>
            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <LoadingSpinner text="Loading videos..." />
                </div>
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
            {!isLoading && !error && meta && videoData.length > 0 && (
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
