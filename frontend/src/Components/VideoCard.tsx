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
import ULIComponent from './ULIComponent';
import { TrashIcon } from '@heroicons/react/24/solid';

export default function VideoCard({
    video,
    mutate,
    role,
    handleOpenInfo,
    handleDeleteVideo,
    handleRetryVideo
}: {
    video: Video;
    mutate: KeyedMutator<ServerResponseMany<Video>>;
    role: UserRole;
    handleOpenInfo: () => void;
    handleDeleteVideo: () => void;
    handleRetryVideo: (video: Video) => Promise<void>;
}) {
    const [visible, setVisible] = useState<boolean>(video.visibility_status);
    const navigate = useNavigate();
    const { toaster } = useToast();

    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleVisibility();
        }
    }

    const handleToggleVisibility = async () => {
        const response = await API.put<null, object>(
            `videos/${video.id}/toggle`,
            {}
        );
        if (response.success) {
            if (toaster) toaster(response.message, ToastState.success);
            await mutate();
        } else {
            if (toaster) toaster(response.message, ToastState.error);
        }
    };

    return (
        <div
            className={`card overflow-hidden ${
                videoIsAvailable(video)
                    ? 'cursor-pointer'
                    : 'cursor-pointer border-3 border-red-500'
            }`}
            onClick={() =>
                videoIsAvailable(video) &&
                navigate(`/viewer/videos/${video.id}`)
            }
        >
            {role === UserRole.Admin && (
                <ULIComponent
                    iconClassName="w-6 h-4"
                    dataTip="Delete video"
                    icon={TrashIcon}
                    tooltipClassName="w-6 h-6 self-start cursor-pointer"
                    onClick={handleDeleteVideo}
                />
            )}
            <div className="flex p-4 gap-2 border-b-2">
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
                    ) : (
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
                    ))}
            </div>
        </div>
    );
}
