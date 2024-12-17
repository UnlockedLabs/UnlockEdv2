import { useNavigate } from 'react-router-dom';
import { StarIcon as SolidStar } from '@heroicons/react/24/solid';
import { KeyedMutator } from 'swr';
import { ToastState, ServerResponseMany, OpenContentItem } from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

interface FavoriteCardProps {
    favorite: OpenContentItem;
    pageQuery: number;
    perPage: number;
    mutate: KeyedMutator<ServerResponseMany<OpenContentItem>>;
    isAdminInStudentView: boolean;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({
    favorite,
    mutate,
    isAdminInStudentView
}) => {
    const navigate = useNavigate();
    const { toaster } = useToast();

    const handleCardClick = () => {
        if (!favorite.visibility_status) {
            return;
        }
        if (favorite.content_type === 'video') {
            navigate(`/viewer/videos/${favorite.content_id}`);
        } else if (favorite.content_type === 'library') {
            navigate(`/viewer/libraries/${favorite.content_id}`);
        } else if (favorite.content_type === 'helpful_link') {
            window.open(favorite.url, '_blank');
        }
    };

    const handleUnfavorite = async () => {
        const endpoint =
            favorite.content_type === 'video'
                ? `videos/${favorite.content_id}/favorite`
                : favorite.content_type === 'helpful_link'
                  ? `helpful-links/favorite/${favorite.content_id}`
                  : `libraries/${favorite.content_id}/favorite`;
        const response = await API.put(endpoint, {});
        if (response.success) {
            toaster(`removed from favorites`, ToastState.success);
            await mutate();
        } else {
            toaster('Failed to unfavorite', ToastState.error);
        }
    };
    return (
        <div
            className={`card  p-4 space-y-2 ${
                favorite.visibility_status
                    ? 'bg-inner-background cursor-pointer'
                    : 'bg-grey-2 cursor-not-allowed'
            } tooltip `}
            {...(!favorite.visibility_status && {
                'data-tip': 'Unavailable Content'
            })}
            onClick={favorite.visibility_status ? handleCardClick : undefined}
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
                src={favorite.thumbnail_url ?? '/ul-logo.png'}
                alt={favorite.title}
                className="h-16 mx-auto object-contain"
            />
            <h3 className="body text-center line-clamp-1">{favorite.title}</h3>
            <p className="body-small text-center">
                {favorite.content_type === 'video'
                    ? favorite.channel_title
                    : favorite.provider_name}
            </p>
        </div>
    );
};

export default FavoriteCard;
