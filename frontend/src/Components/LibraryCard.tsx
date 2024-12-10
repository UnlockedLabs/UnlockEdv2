import { useState, MouseEvent } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import { Library, ServerResponseMany, ToastState, UserRole } from '@/common';
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
    library: Library;
    mutate?: KeyedMutator<ServerResponseMany<Library>>;
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
        if (!mutate) return;
        const response = await API.put<null, object>(
            `libraries/${library.id}/toggle`,
            {}
        );
        if (response.success) {
            toaster(response.message, ToastState.success);
            await mutate();
        } else {
            toaster(response.message, ToastState.error);
        }
    };

    async function toggleLibraryFavorite(e: MouseEvent) {
        if (!mutate) return;
        e.stopPropagation();
        const resp = await API.put<null, object>(
            `libraries/${library.id}/favorite`,
            {}
        );
        toaster(
            resp.message,
            resp.success ? ToastState.success : ToastState.error
        );
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
                        src={library.thumbnail_url ?? ''}
                        alt={`${library.title} thumbnail`}
                    />
                </figure>
                <h3 className="w-3/4 body my-auto mr-7">{library.title}</h3>
            </div>
            {role != UserRole.Student && (
                <div
                    className="absolute right-2 top-2 z-100"
                    onClick={(e) => void toggleLibraryFavorite(e)}
                >
                    {/* don't display the favorite toggle when admin is viewing in student view*/}
                    <ULIComponent
                        tooltipClassName="absolute right-2 top-2 z-100"
                        iconClassName={`w-6 h-6 ${library.favorites.length > 0 && 'text-primary-yellow'}`}
                        icon={
                            AdminRoles.includes(role)
                                ? library.favorites.length > 0
                                    ? FlagIcon
                                    : FlagIconOutline
                                : library.favorites.length > 0
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
            )}

            <div className="p-4 space-y-2">
                <p className="body-small">{'Kiwix'}</p>
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
