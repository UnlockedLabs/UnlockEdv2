import { useNavigate } from 'react-router-dom';
import { StarIcon as SolidStar } from '@heroicons/react/24/solid';
import { mutate } from 'swr';
import { ToastState, OpenContentFavorite, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

interface FavoriteCardProps {
    favorite: OpenContentFavorite;
    pageQuery: number;
    perPage: number;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ favorite }) => {
    const navigate = useNavigate();
    const { toaster } = useToast();

    const handleCardClick = () => {
        if (favorite.visibility_status) {
            return;
        }
        const state = {
            subLink: favorite.content_url
        };
        if (favorite.type === 'video') {
            navigate(`/viewer/videos/${favorite.content_id}`);
        } else if (favorite.type === 'library') {
            navigate(`/viewer/libraries/${favorite.content_id}`, { state });
        }
    };

    const handleUnfavorite = async () => {
        const endpoint =
            favorite.type === 'video'
                ? `videos/${favorite.content_id}/favorite`
                : `open-content/${favorite.content_id}/save`;

        const { name, open_content_provider_id } = favorite;

        if (!name || !open_content_provider_id) {
            throw new Error('Favorite data is incomplete.');
        }

        const payload = {
            name,
            content_id: favorite.content_id,
            open_content_provider_id,
            content_url: `/api/proxy/libraries/${favorite.content_id}/`
        };

        const response = await API.put(endpoint, payload);
        if (response.success) {
            toaster(`${name} removed from favorites`, ToastState.success);

            await mutate(
                (key: string | null | undefined): boolean => {
                    if (typeof key === 'string') {
                        return key.includes('open-content/favorites');
                    }
                    return false;
                },
                (
                    cachedData:
                        | ServerResponseMany<OpenContentFavorite>
                        | undefined
                ) => {
                    if (!cachedData) return;

                    const newFavorites = cachedData.data.filter(
                        (item: OpenContentFavorite) =>
                            item.content_id !== favorite.content_id
                    );

                    return {
                        ...cachedData,
                        data: newFavorites
                    };
                },
                false
            );

            if (favorite.type === 'library') {
                await mutate('/api/libraries');
            }
        } else {
            toaster('Failed to unfavorite', ToastState.error);
        }
    };
    return (
        <div
            className={`card w-60 h-40  p-4 space-y-2 ${
                favorite.visibility_status
                    ? 'bg-grey-2 cursor-not-allowed'
                    : 'bg-inner-background cursor-pointer'
            }`}
            onClick={favorite.visibility_status ? undefined : handleCardClick}
        >
            <div
                className="absolute top-2 right-2 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    void handleUnfavorite();
                }}
            >
                <SolidStar className="w-5 text-primary-yellow" />
            </div>
            <img
                src={favorite.thumbnail_url}
                alt={favorite.name}
                className="h-16 mx-auto object-contain"
            />
            <h3 className="body text-center line-clamp-1">{favorite.name}</h3>
            <p className="body-small text-center">
                {favorite.type === 'video'
                    ? favorite.channel_title
                    : favorite.provider_name}
            </p>
        </div>
    );
};

export default FavoriteCard;
