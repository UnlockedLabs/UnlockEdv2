import { useLocation, useNavigate } from 'react-router-dom';
import { StarIcon as SolidStar } from '@heroicons/react/24/solid';
import { KeyedMutator } from 'swr';
import {
    ToastState,
    ServerResponseMany,
    OpenContentItem,
    ViewType
} from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

import { isAdministrator, useAuth } from '@/useAuth';

interface FavoriteCardProps {
    favorite: OpenContentItem;
    pageQuery: number;
    perPage: number;
    mutate: KeyedMutator<ServerResponseMany<OpenContentItem>>;
    isAdminInStudentView: boolean;
    view: ViewType;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({
    favorite,
    mutate,
    isAdminInStudentView,
    view
}) => {
    const navigate = useNavigate();
    const { toaster } = useToast();
    const route = useLocation();
    const { user } = useAuth();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    if (!route.pathname.includes('knowledge-center')) {
        view = ViewType.Grid;
    }
    const handleCardClick = () => {
        if (!favorite.visibility_status) {
            return;
        }
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
        switch (oc.content_type) {
            case 'video':
                return `/api/photos/${oc.external_id}.jpg`;
            default:
                return oc.thumbnail_url ?? '/ul-logo.png';
        }
    }

    const handleUnfavorite = async () => {
        let endpoint = '';
        let payload = {};

        if (favorite.content_type === 'video') {
            endpoint = `videos/${favorite.content_id}/favorite`;
        } else if (favorite.content_type === 'helpful_link') {
            endpoint = `helpful-links/favorite/${favorite.content_id}`;
        } else if (favorite.content_type === 'library') {
            if (favorite.url.includes('/api/proxy/')) {
                //nested
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
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        if (response.success) {
            toaster(`Removed from favorites`, ToastState.success);
            await mutate();
        } else {
            toaster('Failed to unfavorite', ToastState.error);
        }
    };
    if (view == ViewType.Grid) {
        return (
            <div
                className={`card p-4 space-y-2
            'w-full'}
             ${
                 favorite.visibility_status
                     ? ' cursor-pointer'
                     : 'bg-grey-2 cursor-not-allowed'
             } tooltip`}
                {...(!favorite.visibility_status && {
                    'data-tip': 'This content is no longer accessible'
                })}
                onClick={
                    favorite.visibility_status ? handleCardClick : undefined
                }
            >
                {!isAdminInStudentView && (
                    <div
                        className="absolute top-2 right-2 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleUnfavorite();
                        }}
                    >
                        <SolidStar className="w-5 text-primary-yellow" />
                    </div>
                )}
                <img
                    src={getThumbnailUrl(favorite)}
                    alt={favorite.title}
                    className="h-16 mx-auto object-contain"
                />
                <h3 className="body text-center line-clamp-1">
                    {favorite.title}
                </h3>
                <p className="body-small text-center">
                    {favorite.content_type === 'video'
                        ? favorite.channel_title
                        : favorite.provider_name}
                </p>
            </div>
        );
    } else {
        return (
            <div
                className={`card p-4 flex flex-row items-center gap-4 cursor-pointer w-full ${
                    favorite.visibility_status
                        ? 'cursor-pointer'
                        : 'bg-grey-2 cursor-not-allowed'
                } tooltip`}
                {...(!favorite.visibility_status && {
                    'data-tip': 'This content is no longer accessible'
                })}
                onClick={
                    favorite.visibility_status ? handleCardClick : undefined
                }
            >
                <figure className="w-12 h-12 flex-shrink-0 bg-cover">
                    <img
                        src={getThumbnailUrl(favorite)}
                        alt={favorite.title}
                        className="object-contain"
                    />
                </figure>

                <div className="flex flex-col flex-1 text-left">
                    <h3 className="body">{favorite.title}</h3>
                    <p className="body-small">
                        {favorite.content_type === 'video'
                            ? favorite.channel_title
                            : favorite.provider_name}
                    </p>
                </div>

                {!isAdminInStudentView && (
                    <div
                        className="w-6 h-6 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleUnfavorite();
                        }}
                    >
                        <SolidStar className="w-5 text-primary-yellow" />
                    </div>
                )}
            </div>
        );
    }
};

export default FavoriteCard;
