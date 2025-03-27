import {
    HelpfulLink,
    ModalType,
    ServerResponseOne,
    ToastState,
    UserRole,
    ViewType
} from '@/common';
import API from '@/api/api';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth, isAdministrator, AdminRoles } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import ClampedText from '../ClampedText';
import { useLocation } from 'react-router-dom';

export default function HelpfulLinkCard({
    link,
    showModal,
    mutate,
    role,
    view
}: {
    link: HelpfulLink;
    showModal?: (
        link: HelpfulLink,
        type: ModalType,
        e: React.MouseEvent
    ) => void;
    mutate?: () => void;
    role: UserRole;
    view?: ViewType;
}) {
    const [visible, setVisible] = useState<boolean>(link.visibility_status);
    const [favorite, setFavorite] = useState<boolean>(link.is_favorited);
    const { toaster } = useToast();
    const { user } = useAuth();
    const route = useLocation();

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    if (!route.pathname.includes('knowledge-center')) {
        view = ViewType.Grid;
    }
    const handleToggleAction = async (
        action: 'favorite' | 'toggle',
        e?: React.MouseEvent
    ) => {
        if (e) e.stopPropagation();
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        const response = await API.put<null, object>(
            `helpful-links/${action}/${link.id}`,
            {}
        );
        const actionString =
            action == 'favorite'
                ? favorite
                    ? 'unfavorited'
                    : 'favorited'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';
        if (response.success) {
            toaster(`Helpful link ${actionString}`, ToastState.success);
            if (mutate) mutate();
            if (action == 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Helpful link ${actionString}`, ToastState.error);
        }
    };

    async function handleHelpfulLinkClick(id: number): Promise<void> {
        const resp = (await API.put<{ url: string }, object>(
            `helpful-links/activity/${id}`,
            {}
        )) as ServerResponseOne<{ url: string }>;
        if (resp.success) {
            window.open(resp.data.url, '_blank');
        }
    }

    if (view == ViewType.Grid) {
        return (
            <div
                className="card cursor-pointer"
                onClick={() => {
                    void handleHelpfulLinkClick(link.id);
                }}
            >
                <div className="flex items-center justify-between p-4 gap-2 border-b-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <figure className="w-[48px] h-[48px] bg-cover">
                            <img
                                src={link.thumbnail_url ?? ''}
                                alt={link.title}
                            />
                        </figure>
                        <ClampedText as="h3" className="w-3/4 body my-auto">
                            {link.title}
                        </ClampedText>
                    </div>
                    <div className="flex self-start space-x-2 flex-shrink-0">
                        {AdminRoles.includes(role) ? (
                            showModal != undefined && (
                                <>
                                    <ULIComponent
                                        icon={PencilSquareIcon}
                                        iconClassName={
                                            '!w-5 !h-5 cursor-pointer'
                                        }
                                        onClick={(e) => {
                                            if (e)
                                                showModal(
                                                    link,
                                                    ModalType.Edit,
                                                    e
                                                );
                                        }}
                                    />
                                    <ULIComponent
                                        icon={TrashIcon}
                                        iconClassName={
                                            '!w-5 !h-5 cursor-pointer'
                                        }
                                        onClick={(e) => {
                                            if (e)
                                                showModal(
                                                    link,
                                                    ModalType.Delete,
                                                    e
                                                );
                                        }}
                                    />
                                </>
                            )
                        ) : (
                            <ULIComponent
                                iconClassName={`w-5 h-5 cursor-pointer ${link.is_favorited ? 'text-primary-yellow' : ''}`}
                                icon={
                                    link.is_favorited
                                        ? StarIcon
                                        : StarIconOutline
                                }
                                dataTip="Favorite Helpful Link"
                                onClick={(e) =>
                                    void handleToggleAction('favorite', e)
                                }
                            />
                        )}
                    </div>
                </div>

                <div className="p-4 space-y-2">
                    <ClampedText
                        as="p"
                        className="body-small h-[40px] leading-5"
                    >
                        {link.description}
                    </ClampedText>
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
                onClick={() => void handleHelpfulLinkClick(link.id)}
            >
                <figure className="w-16 h-16 flex-shrink-0 bg-cover">
                    <img
                        src={link.thumbnail_url ?? ''}
                        alt={link.title}
                        className="object-cover"
                    />
                </figure>
                <div className="flex flex-col flex-1">
                    <h3 className="body">{link.title}</h3>
                    <p className="body-small line-clamp-2">
                        {link.description}
                    </p>
                </div>
                {AdminRoles.includes(role) ? (
                    showModal != undefined && (
                        <>
                            <ULIComponent
                                icon={PencilSquareIcon}
                                iconClassName={'!w-5 !h-5 cursor-pointer'}
                                onClick={(e) => {
                                    if (e) showModal(link, ModalType.Edit, e);
                                }}
                            />
                            <ULIComponent
                                icon={TrashIcon}
                                iconClassName={'!w-5 !h-5 cursor-pointer'}
                                onClick={(e) => {
                                    if (e) showModal(link, ModalType.Delete, e);
                                }}
                            />
                        </>
                    )
                ) : (
                    <ULIComponent
                        iconClassName={`w-5 h-5 cursor-pointer ${link.is_favorited ? 'text-primary-yellow' : ''}`}
                        icon={link.is_favorited ? StarIcon : StarIconOutline}
                        dataTip="Favorite Helpful Link"
                        onClick={(e) => void handleToggleAction('favorite', e)}
                    />
                )}

                {AdminRoles.includes(role) && (
                    <VisibleHiddenToggle
                        visible={link.visibility_status}
                        changeVisibility={() =>
                            void handleToggleAction('toggle')
                        }
                        view={view}
                    />
                )}
            </div>
        );
    }
}
