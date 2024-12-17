import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ModalType,
    ServerResponseOne,
    ToastState,
    UserRole
} from '@/common';
import API from '@/api/api';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState, MouseEvent } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminRoles, useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { KeyedMutator } from 'swr';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';

export default function HelpfulLinkCard({
    link,
    showModal,
    mutate,
    role,
    onFavoriteToggle
}: {
    link: HelpfulLink;
    showModal?: (link: HelpfulLink, type: ModalType) => void;
    mutate?: KeyedMutator<ServerResponseOne<HelpfulLinkAndSort>>;
    role?: UserRole;
    onFavoriteToggle?: (linkID: number, isFavorited: boolean) => void;
}) {
    const [visible, setVisible] = useState<boolean>(link.visibility_status);
    const { toaster } = useToast();
    const { user } = useAuth();
    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleVisibility();
        }
    }

    const handleToggleVisibility = async () => {
        const response = await API.put<null, object>(
            `helpful-links/toggle/${link.id}`,
            {}
        );
        toaster(
            response.message,
            response.success ? ToastState.success : ToastState.error
        );
        if (mutate) void mutate();
    };

    if (!user) {
        return null;
    }

    async function toggleLinkFavorite(e: MouseEvent) {
        if (!mutate) return;
        e.preventDefault();
        e.stopPropagation();
        const resp = await API.put<null, object>(
            `helpful-links/favorite/${link.id}`,
            {}
        );
        if (resp.success) {
            const isFavorited = !link.is_favorited;
            onFavoriteToggle?.(link.id, isFavorited);
            await mutate();
        }
        toaster(
            resp.message,
            resp.success ? ToastState.success : ToastState.error
        );
        void mutate();
    }
    return (
        <div className="card p-4 space-y-2">
            {AdminRoles.includes(role ?? user.role) &&
                showModal != undefined && (
                    <div className="flex flex-row gap-2 justify-end">
                        <ULIComponent
                            icon={PencilSquareIcon}
                            iconClassName={'cursor-pointer'}
                            onClick={() => showModal(link, ModalType.Edit)}
                        />
                        <ULIComponent
                            icon={TrashIcon}
                            iconClassName={'cursor-pointer'}
                            onClick={() => showModal(link, ModalType.Delete)}
                        />
                    </div>
                )}
            {AdminRoles.includes(role ?? UserRole.Student) && (
                <div
                    className="right-1 top-1 z-100 favorite-toggle"
                    onClick={(e) => void toggleLinkFavorite(e)}
                >
                    <ULIComponent
                        tooltipClassName="absolute right-2 top-2 z-100"
                        iconClassName={`w-6 h-6 cursor-pointer ${link.is_favorited ? 'text-primary-yellow' : ''}`}
                        icon={link.is_favorited ? StarIcon : StarIconOutline}
                    />
                </div>
            )}
            <img src={link.thumbnail_url} alt={link.title} className="w-10" />
            <h3 className="body">{link.title}</h3>
            <p className="body line-clamp-2 h-10">{link.description}</p>

            {AdminRoles.includes(role ?? user.role) && (
                <VisibleHiddenToggle
                    visible={visible}
                    changeVisibility={changeVisibility}
                />
            )}
        </div>
    );
}
