import { useRef, useState } from 'react';
import useSWR from 'swr';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import {
    ToastState,
    Video,
    ServerResponseMany,
    UserRole,
    FilterLibrariesVidsandHelpfulLinksAdmin,
    MAX_DOWNLOAD_ATTEMPTS,
    getVideoErrorMessage
} from '../common';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import API from '@/api/api';
import { AxiosError } from 'axios';
import VideoCard from '@/Components/VideoCard';
import { useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { useNavigate } from 'react-router-dom';
import {
    AddVideoModal,
    closeModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';

export default function VideoManagement() {
    const { user } = useAuth();
    const addVideoModal = useRef<HTMLDialogElement>(null);
    const [targetVideo, setTargetVideo] = useState<Video | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 300);
    const videoErrorModal = useRef<HTMLDialogElement>(null);
    const [polling, setPolling] = useState<boolean>(false);
    const [perPage, setPerPage] = useState(12);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksAdmin['Title (A to Z)']
    );
    const navigate = useNavigate();
    const { toaster } = useToast();
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        AxiosError
    >(
        `/api/videos?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}`
    );

    const videoData = data?.data ?? [];
    const meta = data?.meta;
    if (!user) {
        return null;
    }
    if (user.role === UserRole.Student) {
        navigate('/knowledge-center/videos', { replace: true });
    }

    const pollVideos = (delay: number) => {
        if (!polling) return;
        void mutate().then(() => {
            if (delay > 10000) {
                setPolling(false);
                return;
            }
            delay *= 2;
            setTimeout((delay: number) => pollVideos(delay), delay, delay);
        });
    };

    const handleRetryVideo = async (video: Video) => {
        const response = await API.put<null, object>(
            `videos/${video.id}/retry`,
            {}
        );
        if (response.success) {
            toaster('Video uploaded successfully', ToastState.success);
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
        } else {
            toaster('Error uploading video', ToastState.error);
        }
    };

    const prepError = () => {
        if (!targetVideo) return;
        return targetVideo.video_download_attempts.length >=
            MAX_DOWNLOAD_ATTEMPTS
            ? `This video has reached the maximum download attempts. Please remove and try again`
            : `Download is processsing: ${getVideoErrorMessage(targetVideo) ?? ''}
                   The video download will be retried every 3 hours`;
    };

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
            <div className="flex justify-between">
                <div className="flex flex-row gap-4">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <DropdownControl
                        label="Order by"
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksAdmin}
                    />
                </div>
                <button
                    className="button items-center"
                    onClick={() => showModal(addVideoModal)}
                >
                    <PlusCircleIcon className="w-4 my-auto" />
                    Add Videos
                </button>
            </div>
            <div className="grid grid-cols-4 gap-6">
                {videoData.map((video) => (
                    <VideoCard
                        key={video.id}
                        video={video}
                        mutate={mutate}
                        role={user?.role ?? UserRole.Student}
                        handleRetryVideo={async () => {
                            if (polling) {
                                toaster(
                                    'Please wait several minutes before attempting to retry newly added videos',
                                    ToastState.error
                                );
                                return;
                            }
                            await handleRetryVideo(video);
                        }}
                        handleOpenInfo={() => {
                            setTargetVideo(video);
                            showModal(videoErrorModal);
                        }}
                    />
                ))}
            </div>
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                        specialPageSelecton
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
            <AddVideoModal mutate={mutate} ref={addVideoModal} />
            <TextOnlyModal
                ref={videoErrorModal}
                type={TextModalType.Information}
                title={'Video Status'}
                text={prepError() ?? ''}
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => {
                    closeModal(videoErrorModal);
                    setTargetVideo(null);
                }}
            ></TextOnlyModal>
        </>
    );
}
