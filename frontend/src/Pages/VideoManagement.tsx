import { useRef, useState } from 'react';
import useSWR from 'swr';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import {
    ModalType,
    ToastState,
    Video,
    ServerResponseMany,
    UserRole
} from '../common';
import AddVideosForm from '@/Components/forms/AddVideosForm';
import Modal from '@/Components/Modal';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import API from '@/api/api';
import { AxiosError } from 'axios';
import VideoCard from '@/Components/VideoCard';
import { useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import VideoInfoModalForm from '@/Components/forms/VideoInfoModalForm';
import { useNavigate } from 'react-router-dom';

export default function VideoManagement() {
    const { user } = useAuth();
    const addVideoModal = useRef<HTMLDialogElement>(null);
    const [targetVideo, setTargetVideo] = useState<Video | undefined>(
        undefined
    );
    const [searchTerm, setSearchTerm] = useState('');
    const searchQuery = useDebounceValue(searchTerm, 300);
    const videoErrorModal = useRef<HTMLDialogElement>(null);
    const [polling, setPolling] = useState<boolean>(false);
    const [perPage, setPerPage] = useState(12);
    const [pageQuery, setPageQuery] = useState(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
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

    const handleAddVideoSuccess = (msg: string, state: ToastState) => {
        if (state !== ToastState.null) toaster(msg, state);
        addVideoModal.current?.close();
        setPolling(true);
        setTimeout(() => pollVideos(1000), 1000);
    };

    const handleRetryVideo = async (video: Video) => {
        const response = await API.put<null, object>(
            `videos/${video.id}/retry`,
            {}
        );
        if (response.success) {
            toaster(response.message, ToastState.success);
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
        } else {
            toaster(response.message, ToastState.error);
        }
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
                        enumType={{
                            'Date Added ↓': 'created_at DESC',
                            'Date Added ↑': 'created_at ASC',
                            'Title (A-Z)': 'title ASC',
                            'Title (Z-A)': 'title DESC'
                        }}
                    />
                </div>
                <button
                    className="button items-center"
                    onClick={() => addVideoModal.current?.showModal()}
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
                                    'please wait several minutes before attempting to retry newly added videos',
                                    ToastState.error
                                );
                                return;
                            }
                            await handleRetryVideo(video);
                        }}
                        handleOpenInfo={() => {
                            setTargetVideo(video);
                            videoErrorModal.current?.showModal();
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
            <Modal
                ref={addVideoModal}
                type={ModalType.Add}
                item="Videos"
                form={<AddVideosForm onSuccess={handleAddVideoSuccess} />}
            />
            {targetVideo && (
                <div>
                    <Modal
                        ref={videoErrorModal}
                        item="video info"
                        form={
                            <VideoInfoModalForm
                                video={targetVideo}
                                onClose={() => {
                                    videoErrorModal.current?.close();
                                    setTargetVideo(undefined);
                                }}
                            />
                        }
                        type={ModalType.Show}
                    />
                </div>
            )}
        </>
    );
}
