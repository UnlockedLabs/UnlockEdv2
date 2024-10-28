import { useState } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import {
    Video,
    ServerResponseMany,
    ToastState,
    UserRole,
    videoIsAvailable
} from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';

export default function VideoCard({
    video,
    mutate,
    role
}: {
    video: Video;
    mutate: KeyedMutator<ServerResponseMany<Video>>;
    role: UserRole;
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
                    : 'cursor-not-allowed border-3 border-red-500'
            }`}
            onClick={() =>
                videoIsAvailable(video) &&
                navigate(`/viewer/videos/${video.id}`)
            }
        >
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
                        : `Video currently unavailable.
                           May be in the process of downloading, Please check back later`}
                </p>
                {role === UserRole.Admin && (
                    <VisibleHiddenToggle
                        visible={visible}
                        changeVisibility={changeVisibility}
                    />
                )}
            </div>
        </div>
    );
}
