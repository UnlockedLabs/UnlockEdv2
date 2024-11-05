import { useState } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import {
    Video,
    ServerResponseMany,
    ToastState,
    UserRole,
    videoIsAvailable,
    getVideoErrorMessage
} from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';

export default function VideoCard({
    video,
    mutate,
    role,
    handleOpenInfo,
    handleRetryVideo
}: {
    video: Video;
    mutate: KeyedMutator<ServerResponseMany<Video>>;
    role: UserRole;
    handleOpenInfo?: () => void;
    handleRetryVideo?: (video: Video) => Promise<void>;
}) {
    const [visible, setVisible] = useState<boolean>(video.visibility_status);
    const navigate = useNavigate();
    const { toaster } = useToast();

    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleAction('visibility');
        }
    }

    const handleToggleAction = async (action: 'favorite' | 'visibility') => {
        const response = await API.put<null, object>(
            `videos/${video.id}/${action}`,
            {}
        );
        if (response.success) {
            if (toaster) toaster(response.message, ToastState.success);
            await mutate();
        } else {
            if (toaster) toaster(response.message, ToastState.error);
        }
    };
    const toMinutes = (duration: number): string => {
        return `${Math.round(duration / 60)} min`;
    };

    let bookmark: JSX.Element;
    if (video.video_favorites && video.video_favorites.length > 0) {
        bookmark = <BookmarkIcon className="h-5 text-primary-yellow" />;
    } else bookmark = <BookmarkIconOutline className={`h-5 text-black`} />;
    return (
        <div
            className={`card overflow-visible ${
                videoIsAvailable(video)
                    ? 'cursor-pointer'
                    : 'cursor-pointer border-3 border-red-500'
            }`}
        >
            {role === UserRole.Student && (
                <div
                    className="tooltip tooltip-top w-6 h-6"
                    data-tip="Favorite video"
                    onClick={() => void handleToggleAction('favorite')}
                >
                    {bookmark}
                </div>
            )}
            <div
                className="flex p-4 gap-2 border-b-2"
                onClick={() =>
                    videoIsAvailable(video) &&
                    navigate(`/viewer/videos/${video.id}`)
                }
            >
                <figure className="w-[300px] bg-cover">
                    <img
                        src={video?.thumbnail_url ?? ''}
                        alt={`${video.title} thumbnail`}
                    />
                </figure>
                <h3 className="w-3/4 body my-auto">{video.title}</h3>
            </div>
            <div className="p-4 space-y-2">
                <p className="body-medium font-bold">{video.channel_title}</p>
                <p className="body-small font-bold">
                    {toMinutes(video.duration)}
                </p>
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {videoIsAvailable(video)
                        ? video?.description
                        : (getVideoErrorMessage(video) ??
                          `Video currently unavailable.
                           May be in the process of downloading, Please check back later`)}
                </p>
                {role === UserRole.Admin &&
                    (videoIsAvailable(video) ? (
                        <VisibleHiddenToggle
                            visible={visible}
                            changeVisibility={changeVisibility}
                        />
                    ) : handleRetryVideo ? (
                        <div>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={handleOpenInfo}
                            >
                                View Status
                            </button>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={() => void handleRetryVideo(video)}
                            >
                                Retry Download
                            </button>
                        </div>
                    ) : null)}
            </div>
        </div>
    );
}
