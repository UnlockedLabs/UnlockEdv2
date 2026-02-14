import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, StarOff } from 'lucide-react';
import { Video, ToastState, UserRole, ViewType, ServerResponseMany } from '@/types';
import { useAuth, isAdministrator, AdminRoles } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { videoIsAvailable, getVideoErrorMessage } from '@/lib/formatters';
import { KeyedMutator } from 'swr';
import API from '@/api/api';

interface VideoCardProps {
    video: Video;
    mutate: KeyedMutator<ServerResponseMany<Video>>;
    role: UserRole;
    handleOpenInfo?: () => void;
    handleRetryVideo?: (video: Video) => Promise<void>;
    view: ViewType;
}

function toMinutes(duration: number): string {
    return `${Math.round(duration / 60)} min`;
}

export default function VideoCard({
    video,
    mutate,
    role,
    handleOpenInfo,
    handleRetryVideo,
    view
}: VideoCardProps) {
    const [visible, setVisible] = useState(video.visibility_status);
    const [favorite, setFavorite] = useState(video.is_favorited);
    const navigate = useNavigate();
    const { toaster } = useToast();
    const route = useLocation();
    const { user } = useAuth();
    const isAdmin = AdminRoles.includes(role);
    const available = videoIsAvailable(video);

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
            action === 'favorite'
                ? favorite
                    ? 'unfavorited'
                    : 'favorited'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';
        if (response.success) {
            toaster(`Video ${actionString}`, ToastState.success);
            await mutate();
            if (action === 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Video ${actionString}`, ToastState.error);
        }
    };

    const thumbnailSrc = `/api/photos/${video.external_id}.jpg`;

    if (view === ViewType.Grid) {
        return (
            <div
                className={`bg-white rounded-lg border cursor-pointer hover:shadow-md transition-shadow relative ${
                    available
                        ? 'border-gray-200'
                        : 'border-destructive border-2'
                }`}
                onClick={() =>
                    available && navigate(`/viewer/videos/${video.id}`)
                }
            >
                {!isAdmin && (
                    <button
                        className="absolute right-2 top-2 z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleAction('favorite');
                        }}
                    >
                        {favorite ? (
                            <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                        ) : (
                            <StarOff className="size-5" />
                        )}
                    </button>
                )}
                <div className="flex flex-col p-4 gap-2 border-b border-gray-200">
                    <img
                        src={thumbnailSrc}
                        alt={video.title}
                        className="w-1/2 mx-auto object-cover"
                    />
                    <h3 className="text-sm font-medium text-[#203622] text-center h-10 line-clamp-2">
                        {video.title}
                    </h3>
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-sm font-bold line-clamp-2">
                        {video.channel_title} - {toMinutes(video.duration)}
                    </p>
                    <p className="text-xs text-muted-foreground h-10 leading-5 line-clamp-2">
                        {available
                            ? video.description
                            : getVideoErrorMessage(video) ??
                              'Video currently unavailable. May be in the process of downloading. Please check back later.'}
                    </p>
                    {isAdmin &&
                        (available ? (
                            <div className="flex items-center gap-2 pt-1">
                                <Switch
                                    checked={visible}
                                    onCheckedChange={() =>
                                        void handleToggleAction('visibility')
                                    }
                                    className="data-[state=checked]:bg-[#556830]"
                                />
                                <span className="text-xs text-muted-foreground">
                                    {visible ? 'Visible' : 'Hidden'}
                                </span>
                            </div>
                        ) : handleRetryVideo ? (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInfo?.();
                                    }}
                                >
                                    View Status
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleRetryVideo(video);
                                    }}
                                >
                                    Retry Download
                                </Button>
                            </div>
                        ) : null)}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`bg-white rounded-lg border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow ${
                available ? 'border-gray-200' : 'border-destructive border-2'
            }`}
            onClick={() =>
                available && navigate(`/viewer/videos/${video.id}`)
            }
        >
            <img
                src={thumbnailSrc}
                alt={video.title}
                className="w-16 h-16 flex-shrink-0 object-cover"
            />
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-sm font-medium text-[#203622]">
                    {video.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {video.channel_title} - {toMinutes(video.duration)}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {available
                        ? video.description
                        : getVideoErrorMessage(video)}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {!isAdmin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleAction('favorite');
                        }}
                    >
                        {favorite ? (
                            <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                        ) : (
                            <StarOff className="size-5" />
                        )}
                    </button>
                )}
                {isAdmin &&
                    (available ? (
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={visible}
                                onCheckedChange={() =>
                                    void handleToggleAction('visibility')
                                }
                                className="data-[state=checked]:bg-[#556830]"
                            />
                            <span className="text-xs text-muted-foreground">
                                {visible ? 'Visible' : 'Hidden'}
                            </span>
                        </div>
                    ) : handleRetryVideo ? (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInfo?.();
                                }}
                            >
                                View Status
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRetryVideo(video);
                                }}
                            >
                                Retry Download
                            </Button>
                        </div>
                    ) : null)}
            </div>
        </div>
    );
}
