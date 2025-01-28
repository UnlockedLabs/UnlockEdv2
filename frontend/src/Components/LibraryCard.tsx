import { useState, MouseEvent } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import { Library, ToastState, UserRole } from '@/common';
import API from '@/api/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import { AdminRoles } from '@/useAuth';
import ULIComponent from '@/Components/ULIComponent';
import { StarIcon, FlagIcon } from '@heroicons/react/24/solid';
import {
    StarIcon as StarIconOutline,
    FlagIcon as FlagIconOutline,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export default function LibraryCard({
    library,
    mutate,
    role,
    onSearchClick
}: {
    library: Library;
    mutate?: () => void;
    role: UserRole;
    onSearchClick?: () => void;
}) {
    const { toaster } = useToast();
    const [visible, setVisible] = useState<boolean>(library.visibility_status);
    const [favorite, setFavorite] = useState<boolean>(library.is_favorited);
    const navigate = useNavigate();
    const route = useLocation();

    async function handleToggleAction(
        action: 'favorite' | 'toggle',
        e?: MouseEvent
    ) {
        if (!mutate) return;
        if (e) e.stopPropagation();
        const actionString =
            action == 'favorite'
                ? favorite
                    ? role == UserRole.Student
                        ? 'unfavorited'
                        : 'unfeatured'
                    : role == UserRole.Student
                      ? 'favorited'
                      : 'featured'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';
        const resp = await API.put<null, object>(
            `libraries/${library.id}/${action}`,
            {}
        );
        if (resp.success) {
            mutate();
            toaster(`Library ${actionString}`, ToastState.success);
            if (action == 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Library {${actionString}}`, ToastState.error);
        }
    }
    const handleSearchClick = (e?: MouseEvent) => {
        if (e) e.stopPropagation();
        if (onSearchClick) {
            onSearchClick();
        }
    };
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
            <div className="flex items-center justify-end space-x-2 absolute right-2 top-2 z-100">
            {!route.pathname.includes('knowledge-insights') && (
                <div onClick={handleSearchClick}>
                    <ULIComponent
                        icon={MagnifyingGlassIcon}
                        iconClassName="!w-5 !h-5"
                        dataTip={`Search ${library.title}`}
                    />
                </div>
            )}
                <div onClick={(e) => void handleToggleAction('favorite', e)}>
                    {!route.pathname.includes('knowledge-insights') && (
                        <ULIComponent
                            iconClassName={`!w-5 !h-5 ${library.is_favorited && 'text-primary-yellow'}`}
                            icon={
                                AdminRoles.includes(role)
                                    ? library.is_favorited
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
                    )}
                </div>
            </div>

            <div className="p-4 space-y-2">
                <p className="body-small">{'Kiwix'}</p>
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {library?.description}
                </p>
                {AdminRoles.includes(role) && (
                    <VisibleHiddenToggle
                        visible={visible}
                        changeVisibility={() =>
                            void handleToggleAction('toggle')
                        }
                    />
                )}
            </div>
        </div>
    );
}
