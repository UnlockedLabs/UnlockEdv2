import { useNavigate, useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import { KeyedMutator } from 'swr';
import {
    ToastState,
    ServerResponseMany,
    OpenContentItem,
    ViewType
} from '@/types';
import { isAdministrator, useAuth } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import API from '@/api/api';

interface FavoriteCardProps {
    favorite: OpenContentItem;
    mutate: KeyedMutator<ServerResponseMany<OpenContentItem>>;
    isAdminInStudentView: boolean;
    view: ViewType;
}

export default function FavoriteCard({
    favorite,
    mutate,
    isAdminInStudentView,
    view
}: FavoriteCardProps) {
    const navigate = useNavigate();
    const { toaster } = useToast();
    const route = useLocation();
    const { user } = useAuth();

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    const handleCardClick = () => {
        if (!favorite.visibility_status) return;
        if (favorite.content_type === 'video') {
            navigate(`/viewer/videos/${favorite.content_id}`);
        } else if (favorite.content_type === 'library') {
            if (favorite.url.includes('/api/proxy/')) {
                navigate(`/viewer/libraries/${favorite.content_id}`, {
                    state: { url: favorite.url }
                });
            } else {
                navigate(`/viewer/libraries/${favorite.content_id}`);
            }
        } else if (favorite.content_type === 'helpful_link') {
            window.open(favorite.url, '_blank');
        }
    };

    function getThumbnailUrl(oc: OpenContentItem): string {
        if (oc.content_type === 'video') {
            return `/api/photos/${oc.external_id}.jpg`;
        }
        return oc.thumbnail_url ?? '/ul-logo-d.svg';
    }

    const handleUnfavorite = async () => {
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        let endpoint = '';
        let payload = {};
        if (favorite.content_type === 'video') {
            endpoint = `videos/${favorite.content_id}/favorite`;
        } else if (favorite.content_type === 'helpful_link') {
            endpoint = `helpful-links/favorite/${favorite.content_id}`;
        } else if (favorite.content_type === 'library') {
            if (favorite.url.includes('/api/proxy/')) {
                endpoint = `open-content/${favorite.content_id}/bookmark`;
                payload = {
                    open_content_provider_id: favorite.open_content_provider_id,
                    content_url: favorite.url
                };
            } else {
                endpoint = `libraries/${favorite.content_id}/favorite`;
            }
        }
        const response = await API.put(endpoint, payload);
        if (response.success) {
            toaster('Removed from favorites', ToastState.success);
            await mutate();
        } else {
            toaster('Failed to unfavorite', ToastState.error);
        }
    };

    const isDisabled = !favorite.visibility_status;

    if (view === ViewType.Grid) {
        return (
            <div
                className={`bg-white rounded-lg border border-gray-200 p-4 space-y-2 relative ${
                    isDisabled
                        ? 'bg-gray-100 cursor-not-allowed opacity-75'
                        : 'cursor-pointer hover:shadow-md transition-shadow'
                }`}
                title={
                    isDisabled
                        ? 'This content is no longer accessible'
                        : undefined
                }
                onClick={isDisabled ? undefined : handleCardClick}
            >
                {!isAdminInStudentView && (
                    <button
                        className="absolute top-2 right-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleUnfavorite();
                        }}
                    >
                        <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                    </button>
                )}
                <img
                    src={getThumbnailUrl(favorite)}
                    alt={favorite.title}
                    className="h-16 mx-auto object-contain"
                />
                <h3 className="text-sm font-medium text-[#203622] text-center line-clamp-1">
                    {favorite.title}
                </h3>
                <p className="text-xs text-muted-foreground text-center">
                    {favorite.content_type === 'video'
                        ? favorite.channel_title
                        : favorite.provider_name}
                </p>
            </div>
        );
    }

    return (
        <div
            className={`bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 ${
                isDisabled
                    ? 'bg-gray-100 cursor-not-allowed opacity-75'
                    : 'cursor-pointer hover:shadow-md transition-shadow'
            }`}
            title={
                isDisabled
                    ? 'This content is no longer accessible'
                    : undefined
            }
            onClick={isDisabled ? undefined : handleCardClick}
        >
            <img
                src={getThumbnailUrl(favorite)}
                alt={favorite.title}
                className="w-12 h-12 flex-shrink-0 object-contain"
            />
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-sm font-medium text-[#203622]">
                    {favorite.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {favorite.content_type === 'video'
                        ? favorite.channel_title
                        : favorite.provider_name}
                </p>
            </div>
            {!isAdminInStudentView && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleUnfavorite();
                    }}
                >
                    <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                </button>
            )}
        </div>
    );
}
