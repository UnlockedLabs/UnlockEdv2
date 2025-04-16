import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import {
    Video,
    ServerResponseMany,
    UserRole,
    videoIsAvailable,
    ViewType
} from '../common';
import DropdownControl from '../Components/inputs/DropdownControl';
import Pagination from '../Components/Pagination';
import VideoCard from '@/Components/VideoCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useLocation } from 'react-router-dom';
import { LibrarySearchBar } from './inputs';
import LibrarySearchResultsModal from './LibrarySearchResultsModal';
import ToggleView from '@/Components/ToggleView';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function VideoContent() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const route = useLocation();
    const modalRef = useRef<HTMLDialogElement>(null);
    const [searchModalOpen, setSearchModalOpen] = useState<boolean | null>(
        null
    );
    const [activeView, setActiveView] = useSessionViewType('videoView');

    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    const openSearchModal = () => {
        setSearchModalOpen(null); //fire off useEffect
    };
    //execute when the the searchModalOpen changes (choppyness otherwise)
    useEffect(() => {
        if (modalRef.current) {
            modalRef.current.style.visibility = 'visible';
            modalRef.current.showModal();
        }
    }, [searchModalOpen]);
    const closeSearchModal = () => {
        if (modalRef.current) {
            modalRef.current.style.visibility = 'hidden';
            modalRef.current.close();
        }
        setSearchModalOpen(null);
    };
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        Error
    >(
        `/api/videos?search=${searchTerm}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&visibility=${adminWithStudentView() ? UserRole.Student : user?.role}`
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
            <div className="flex flex-row gap-4">
                {videoData && videoData.length > 0 && (
                    <>
                        {' '}
                        <div onClick={() => setSearchModalOpen(true)}>
                            <LibrarySearchBar
                                onSearchClick={openSearchModal}
                                searchPlaceholder="Search..."
                                searchTerm={searchTerm}
                                changeCallback={setSearchTerm}
                                isSearchValid={searchTerm.trim() !== ''}
                            />
                        </div>
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
                    </>
                )}
                <div className="ml-auto">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
            </div>
            <div
                className={`mt-4 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
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
            {searchModalOpen && (
                <LibrarySearchResultsModal
                    ref={modalRef}
                    searchPlaceholder={`Search`}
                    onModalClose={closeSearchModal}
                    useInternalSearchBar={true}
                />
            )}
        </>
    );
}
