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
import DeleteForm from '../Components/DeleteForm';
import Modal from '../Components/Modal';
import SearchBar from '../Components/inputs/SearchBar';
import DropdownControl from '../Components/inputs/DropdownControl';
import Pagination from '../Components/Pagination';
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
    const deleteVideoModal = useRef<HTMLDialogElement>(null);
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
        navigate('/open-content/videos', { replace: true });
    }

    const handleAddVideoSuccess = (msg: string, state: ToastState) => {
        if (state !== ToastState.null) toaster(msg, state);
        addVideoModal.current?.close();
        let delay = 1000;
        const initialVideos = videoData.length;
        const pollVideos = () => {
            void mutate().then((data) => {
                if (
                    (data && data.data.length > initialVideos) ||
                    delay > 10000
                ) {
                    // Stop polling if populated or we max out at 10 seconds
                    // keep polling set for another minute to prevent retries while still processing
                    setTimeout(() => setPolling(false), 128 << 9);
                    return;
                }
                delay *= 2;
                setTimeout(pollVideos, delay);
            });
        };
        setPolling(true);
        setTimeout(pollVideos, delay);
    };

    const handleRetryVideo = async (video: Video) => {
        const response = await API.put<null, object>(
            `videos/${video.id}/retry`,
            {}
        );
        if (response.success) {
            toaster(response.message, ToastState.success);
            await mutate();
        } else {
            toaster(response.message, ToastState.error);
        }
    };

    const handleDeleteVideoSuccess = async () => {
        const response = await API.delete(`videos/${targetVideo?.id}`);
        const state = response.success ? ToastState.success : ToastState.error;
        const msg = response.success
            ? 'Video deleted successfully'
            : response.message;
        deleteVideoModal.current?.close();
        toaster(msg, state);
        setTargetVideo(undefined);
        await mutate();
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
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4 px-8">
                <h1>Video Management</h1>
                <div className="flex justify-between">
                    <div className="flex flex-row gap-x-2">
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
                                'Date Added ↑': 'created_at ASC'
                            }}
                        />
                    </div>
                    <div
                        className="tooltip tooltip-left pl-5"
                        data-tip="Add Videos to open content library"
                    >
                        <button
                            className="btn btn-primary btn-sm text-base-teal"
                            onClick={() => addVideoModal.current?.showModal()}
                        >
                            <PlusCircleIcon className="w-4 my-auto" />
                            Add Videos
                        </button>
                    </div>
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
                            handleDeleteVideo={() => {
                                setTargetVideo(video);
                                deleteVideoModal.current?.showModal();
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
            </div>
            <Modal
                ref={addVideoModal}
                type={ModalType.Add}
                item="Videos"
                form={<AddVideosForm onSuccess={handleAddVideoSuccess} />}
            />
            {targetVideo && (
                <div>
                    <Modal
                        ref={deleteVideoModal}
                        type={ModalType.Confirm}
                        item="Delete Video"
                        form={
                            <DeleteForm
                                item="Video"
                                onCancel={() =>
                                    deleteVideoModal.current?.close()
                                }
                                onSuccess={() =>
                                    void handleDeleteVideoSuccess()
                                }
                            />
                        }
                    />
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
        </div>
    );
}
