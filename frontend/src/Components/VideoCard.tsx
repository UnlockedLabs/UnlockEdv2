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
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { AdminRoles, useAuth, isAdministrator } from '@/useAuth';
import ClampedText from './ClampedText';

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
    const [favorite, setFavorite] = useState<boolean>(video.is_favorited);
    const navigate = useNavigate();
    const { toaster } = useToast();
    const route = useLocation();
    const { user } = useAuth();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    const handleToggleAction = async (action: 'favorite' | 'visibility') => {
        if (adminWithStudentView() && action === 'favorite') {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        const response = await API.put<null, object>(
            `videos/${video.id}/${action}`,
            {}
        );
        const actionString =
            action == 'favorite'
                ? favorite
                    ? 'unfavorited'
                    : 'favorited'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';

        if (response.success) {
            toaster(`Video ${actionString}`, ToastState.success);
            await mutate();
            if (action == 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Video ${actionString}`, ToastState.error);
        }
    };

    const toMinutes = (duration: number): string => {
        return `${Math.round(duration / 60)} min`;
    };

    let bookmark: JSX.Element;
    if (video.is_favorited) {
        bookmark = <StarIcon className="h-5 text-primary-yellow" />;
    } else bookmark = <StarIconOutline className={`h-5 `} />;
    return (
        <div
            className={`card overflow-visible ${
                videoIsAvailable(video)
                    ? 'cursor-pointer'
                    : 'cursor-pointer border-3 border-red-500'
            }`}
            onClick={() =>
                videoIsAvailable(video) &&
                navigate(`/viewer/videos/${video.id}`)
            }
        >
            {!AdminRoles.includes(role) && (
                <div
                    className="tooltip tooltip-top absolute right-2 top-2 w-6 h-6"
                    data-tip="Favorite video"
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleAction('favorite');
                    }}
                >
                    {bookmark}
                </div>
            )}
            <div className="flex flex-col p-4 gap-2 border-b-2">
                <figure className="w-1/2 mx-auto bg-cover">
                    <img
                        src={`/api/photos/${video.external_id}.jpg`}
                        alt={`/youtube.png`}
                    />
                </figure>
                <ClampedText as="h3" className="body text-center h-10 my-auto">
                    {video.title}
                </ClampedText>
            </div>
            <div className="p-4 space-y-2">
                <p className="body font-bold sm:h-10 sm:line-clamp-2">
                    {video.channel_title} - {toMinutes(video.duration)}
                </p>
                <ClampedText as="p" className="body-small h-[40px] leading-5">
                    {videoIsAvailable(video)
                        ? video?.description
                        : getVideoErrorMessage(video) ??
                          `Video currently unavailable.
                            May be in the process of downloading, Please check back later`}
                </ClampedText>
                {AdminRoles.includes(role) &&
                    (videoIsAvailable(video) ? (
                        <VisibleHiddenToggle
                            visible={visible}
                            changeVisibility={() =>
                                void handleToggleAction('visibility')
                            }
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
