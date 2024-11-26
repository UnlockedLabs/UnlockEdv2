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
import { FlagIcon } from '@heroicons/react/24/solid';
import { FlagIcon as FlagIconOutline } from '@heroicons/react/24/outline';

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

    async function toggleLibraryAction(e: MouseEvent) {
        e.stopPropagation();
        const endpoint = `open-content/${library.id}/${AdminRoles.includes(role) ? 'feature' : 'save'}`;
        await API.put(endpoint, {
            name: library.name,
            content_id: library.id,
            open_content_provider_id: library.open_content_provider_id,
            content_url: `/api/proxy/libraries/${library.id}/`
        }).then((resp) => {
            if (resp.success) {
                if (AdminRoles.includes(role)) {
                    library.is_featured = !library.is_featured;
                } else {
                    library.is_favorited = !library.is_favorited;
                }
                toaster(
                    AdminRoles.includes(role)
                        ? library.is_featured
                            ? 'Library featured'
                            : 'Library unfeatured'
                        : library.is_favorited
                          ? 'Library favorited'
                          : 'Library unfavorited',
                    ToastState.success
                );
            }
        });
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
            <div
                className="absolute right-2 top-2 z-100"
                onClick={(e) => void toggleLibraryAction(e)}
            >
                <ULIComponent
                    tooltipClassName="absolute right-2 top-2 z-100"
                    iconClassName={`w-6 h-6 ${AdminRoles.includes(role) ? (library.is_featured ? 'text-primary-yellow' : '') : library.is_favorited ? 'text-primary-yellow' : ''}`}
                    icon={
                        AdminRoles.includes(role)
                            ? library.is_featured
                                ? FlagIcon
                                : FlagIconOutline
                            : library.is_favorited
                              ? StarIcon
                              : StarIconOutline
                    }
                    dataTip={
                        AdminRoles.includes(role)
                            ? 'Feature Library'
                            : 'Favorite Library'
                    }
                />
            </div>
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
