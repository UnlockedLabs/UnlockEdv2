import { useNavigate } from 'react-router-dom';
import { StarIcon as SolidStar } from '@heroicons/react/24/solid';
import { KeyedMutator } from 'swr';
import { ToastState, OpenContentFavorite, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

interface FavoriteCardProps {
    favorite: OpenContentFavorite;
    pageQuery: number;
    perPage: number;
    mutate: KeyedMutator<ServerResponseMany<OpenContentFavorite>>;
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
        if (favorite.visibility_status) {
            return;
        }
        if (favorite.content_type === 'video') {
            navigate(`/viewer/videos/${favorite.content_id}`);
        } else if (favorite.content_type === 'library') {
            navigate(`/viewer/libraries/${favorite.content_id}`);
        }
    };

    const handleUnfavorite = async () => {
        const endpoint =
            favorite.content_type === 'video'
                ? `videos/${favorite.content_id}/favorite`
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
                    ? 'bg-grey-2 cursor-not-allowed'
                    : 'bg-inner-background cursor-pointer'
            } tooltip `}
            data-tip={favorite.visibility_status ? 'Unavailable Content' : ''}
            onClick={favorite.visibility_status ? undefined : handleCardClick}
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
                src={favorite.thumbnail_url}
                alt={favorite.name}
                className="h-16 mx-auto object-contain"
            />
            <h3 className="body text-center line-clamp-1">{favorite.name}</h3>
            <p className="body-small text-center">
                {favorite.content_type === 'video'
                    ? favorite.channel_title
                    : favorite.provider_name}
            </p>
        </div>
    );
};

export default FavoriteCard;
