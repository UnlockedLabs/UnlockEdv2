import { useState, MouseEvent } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import { Library, ToastState, UserRole, ViewType } from '@/common';
import API from '@/api/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import { useAuth, AdminRoles, isAdministrator } from '@/useAuth';
import ULIComponent from '@/Components/ULIComponent';
import { StarIcon, FlagIcon } from '@heroicons/react/24/solid';
import {
    StarIcon as StarIconOutline,
    FlagIcon as FlagIconOutline,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import ClampedText from './ClampedText';

export default function LibraryCard({
    library,
    mutate,
    role,
    onSearchClick,
    view
}: {
    library: Library;
    mutate?: () => void;
    role: UserRole;
    onSearchClick?: () => void;
    view?: ViewType;
}) {
    const { toaster } = useToast();
    const [visible, setVisible] = useState<boolean>(library.visibility_status);
    const [favorite, setFavorite] = useState<boolean>(library.is_favorited);
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    if (!route.pathname.includes('knowledge-center')) {
        view = ViewType.Grid;
    }

    async function handleToggleAction(
        action: 'favorite' | 'toggle',
        e?: MouseEvent
    ) {
        if (!mutate) return;
        if (e) e.stopPropagation();
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
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
    if (view == ViewType.Grid) {
        return (
            <div
                className="card cursor-pointer"
                onClick={() => navigate(`/viewer/libraries/${library.id}`)}
            >
                <div className="flex items-center justify-between p-4 gap-2 border-b-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <figure className="w-[48px] h-[48px] flex-shrink-0 bg-cover">
                            <img
                                src={library.thumbnail_url ?? ''}
                                alt={`${library.title} thumbnail`}
                            />
                        </figure>
                        <ClampedText as="h3" className="w-3/4 body my-auto">
                            {library.title}
                        </ClampedText>
                    </div>
                    <div className="flex self-start  space-x-2 flex-shrink-0">
                        {!route.pathname.includes('knowledge-insights') &&
                            onSearchClick && (
                                <div
                                    onClick={handleSearchClick}
                                    id="knowledge-center-search-lib"
                                >
                                    <ULIComponent
                                        icon={MagnifyingGlassIcon}
                                        iconClassName="!w-5 !h-5"
                                        dataTip={`Search ${library.title}`}
                                        tooltipClassName="tooltip-left"
                                    />
                                </div>
                            )}
                        <div
                            onClick={(e) =>
                                void handleToggleAction('favorite', e)
                            }
                            id="knowledge-center-fav-lib"
                        >
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
                                    tooltipClassName="tooltip-left"
                                />
                            )}
                        </div>
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
                            view={view}
                        />
                    )}
                </div>
            </div>
        );
    } else {
        return (
            <div
                className="card p-4 flex flex-row items-center gap-4 cursor-pointer"
                onClick={() => navigate(`/viewer/libraries/${library.id}`)}
            >
                <figure className="w-16 h-16 flex-shrink-0 bg-cover">
                    <img
                        src={library.thumbnail_url ?? ''}
                        alt={`${library.title} thumbnail`}
                        className="object-cover"
                    />
                </figure>

                <div className="flex flex-col flex-1">
                    <h3 className="body">{library.title}</h3>
                    <p className="body-small line-clamp-2">
                        {library.description}
                    </p>
                </div>
                <div className="flex flex-row items-center space-x-2">
                    {!route.pathname.includes('knowledge-insights') &&
                        onSearchClick && (
                            <div
                                onClick={handleSearchClick}
                                id="knowledge-center-search-lib"
                            >
                                <ULIComponent
                                    icon={MagnifyingGlassIcon}
                                    iconClassName="!w-5 !h-5"
                                    dataTip={`Search ${library.title}`}
                                    tooltipClassName="tooltip-left"
                                />
                            </div>
                        )}
                    <div
                        onClick={(e) => void handleToggleAction('favorite', e)}
                        id="knowledge-center-fav-lib"
                    >
                        {!route.pathname.includes('knowledge-insights') && (
                            <ULIComponent
                                iconClassName={`!w-5 !h-5 ${library.is_favorited ? 'text-primary-yellow' : ''}`}
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
                                tooltipClassName="tooltip-left"
                            />
                        )}
                    </div>
                    {AdminRoles.includes(role) && (
                        <VisibleHiddenToggle
                            visible={visible}
                            changeVisibility={() =>
                                void handleToggleAction('toggle')
                            }
                            view={view}
                        />
                    )}
                </div>
            </div>
        );
    }
}
