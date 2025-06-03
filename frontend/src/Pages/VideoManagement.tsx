import { useRef, useState } from 'react';
import useSWR from 'swr';
import {
    ToastState,
    Video,
    ServerResponseMany,
    UserRole,
    MAX_DOWNLOAD_ATTEMPTS,
    getVideoErrorMessage,
    ViewType
} from '../common';
import Pagination from '@/Components/Pagination';
import API from '@/api/api';
import VideoCard from '@/Components/VideoCard';
import { useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    AddVideoModal,
    closeModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { AddButton } from '@/Components/inputs';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function VideoManagement() {
    const { user } = useAuth();
    const addVideoModal = useRef<HTMLDialogElement>(null);
    const [targetVideo, setTargetVideo] = useState<Video | null>(null);
    const videoErrorModal = useRef<HTMLDialogElement>(null);
    const [polling, setPolling] = useState<boolean>(false);
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);
    const navigate = useNavigate();
    const { toaster } = useToast();

    const { activeView, sortQuery } = useOutletContext<{
        activeView: ViewType;
        searchTerm: string;
        sortQuery: string;
    }>();
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>,
        Error
    >(`/api/videos?page=${pageQuery}&per_page=${perPage}&${sortQuery}`);

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

    return (
        <>
            <div className="flex justify-end items-center">
                <AddButton
                    label="Add Videos"
                    onClick={() => showModal(addVideoModal)}
                />
            </div>
            <div
                className={`${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
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
