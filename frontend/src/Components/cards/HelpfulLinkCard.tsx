import {
    HelpfulLink,
    ModalType,
    ServerResponseOne,
    ToastState,
    UserRole
} from '@/common';
import API from '@/api/api';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminRoles } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';

export default function HelpfulLinkCard({
    link,
    showModal,
    mutate,
    role
}: {
    link: HelpfulLink;
    showModal?: (
        link: HelpfulLink,
        type: ModalType,
        e: React.MouseEvent
    ) => void;
    mutate?: () => void;
    role: UserRole;
}) {
    const [visible, setVisible] = useState<boolean>(link.visibility_status);
    const [favorite, setFavorite] = useState<boolean>(link.is_favorited);
    const { toaster } = useToast();

    const handleToggleAction = async (
        action: 'favorite' | 'toggle',
        e?: React.MouseEvent
    ) => {
        if (e) e.stopPropagation();
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

    return (
        <div
            className="card p-4 space-y-2 relative"
            onClick={() => {
                void handleHelpfulLinkClick(link.id);
            }}
        >
            {AdminRoles.includes(role) ? (
                showModal != undefined && (
                    <div className="flex flex-row gap-2 absolute top-4 right-4 z-100">
                        <ULIComponent
                            icon={PencilSquareIcon}
                            iconClassName={'cursor-pointer'}
                            onClick={(e) => {
                                if (e) showModal(link, ModalType.Edit, e);
                            }}
                        />
                        <ULIComponent
                            icon={TrashIcon}
                            iconClassName={'cursor-pointer'}
                            onClick={(e) => {
                                if (e) showModal(link, ModalType.Delete, e);
                            }}
                        />
                    </div>
                )
            ) : (
                <ULIComponent
                    iconClassName={`absolute right-1 w-6 h-6 cursor-pointer ${link.is_favorited ? 'text-primary-yellow' : ''}`}
                    icon={link.is_favorited ? StarIcon : StarIconOutline}
                    onClick={(e) => {
                        if (e) void handleToggleAction('favorite', e);
                    }}
                />
            )}
            <img
                src={link.thumbnail_url}
                alt={link.title}
                className="h-16 mx-auto object-contain"
            />
            <h3 className="body">{link.title}</h3>
            <p className="body line-clamp-2 h-10">{link.description}</p>

            {AdminRoles.includes(role) && (
                <VisibleHiddenToggle
                    visible={visible}
                    changeVisibility={() => void handleToggleAction('toggle')}
                />
            )}
        </div>
    );
}
