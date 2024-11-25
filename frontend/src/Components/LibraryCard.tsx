import { useState, MouseEvent } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import { LibraryDto, ServerResponseMany, ToastState, UserRole } from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import { AdminRoles } from '@/useAuth';
import ULIComponent from '@/Components/ULIComponent';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';

export default function LibraryCard({
    library,
    mutate,
    role
}: {
    library: LibraryDto;
    mutate: KeyedMutator<ServerResponseMany<LibraryDto>>;
    role: UserRole;
}) {
    const { toaster } = useToast();
    const [visible, setVisible] = useState<boolean>(library.visibility_status);
    const [favorited, setFavorited] = useState<boolean>(library.is_favorited);
    const navigate = useNavigate();

    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleVisibility();
        }
    }

    const handleToggleVisibility = async () => {
        const response = await API.put<null, object>(
            `libraries/${library.id}`,
            {}
        );
        if (response.success) {
            toaster(response.message, ToastState.success);
            await mutate();
        } else {
            toaster(response.message, ToastState.error);
        }
    };
    const openContentProviderName =
        library?.open_content_provider_name.charAt(0).toUpperCase() +
        library?.open_content_provider_name.slice(1);

    async function toggleFavorite(e: MouseEvent) {
        e.stopPropagation();
        await API.put(`open-content/${library.id}/save`, {
            name: library.name,
            content_id: library.id,
            open_content_provider_id: library.open_content_provider_id,
            content_url: `/api/proxy/libraries/${library.id}/`
        })
            .then((resp) => {
                if (resp.success) {
                    setFavorited(!favorited);
                    library.is_favorited = !favorited;
                    toaster(
                        favorited
                            ? 'Removed from favorites.'
                            : 'Added to favorites',
                        ToastState.success
                    );
                }
            })
            .catch((error) => console.error(error));
        void mutate();
    }

    return (
        <div
            className="card cursor-pointer"
            onClick={() => navigate(`/viewer/libraries/${library.id}`)}
        >
            <div className="flex p-4 gap-2 border-b-2">
                <figure className="w-[48px] h-[48px] bg-cover">
                    <img
                        src={library.image_url ?? ''}
                        alt={`${library.name} thumbnail`}
                    />
                </figure>
                <h3 className="w-3/4 body my-auto">{library.name}</h3>
            </div>
            {!AdminRoles.includes(role) && (
                <div onClick={(e: MouseEvent) => void toggleFavorite(e)}>
                    <ULIComponent
                        tooltipClassName={'absolute right-2 top-2 z-100'}
                        iconClassName={`w-6 h-6 ${library.is_favorited ? 'text-primary-yellow' : ''}`}
                        icon={library.is_favorited ? StarIcon : StarIconOutline}
                        dataTip="Favorite Library"
                    />
                </div>
            )}

            <div className="p-4 space-y-2">
                <p className="body-small">{openContentProviderName}</p>
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {library?.description}
                </p>
                {AdminRoles.includes(role) && (
                    <VisibleHiddenToggle
                        visible={visible}
                        changeVisibility={changeVisibility}
                    />
                )}
            </div>
        </div>
    );
}
