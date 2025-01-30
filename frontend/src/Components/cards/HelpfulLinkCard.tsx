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
            className="card cursor-pointer"
            onClick={() => {
                void handleHelpfulLinkClick(link.id);
            }}
        >
            <div className="flex p-4 gap-2 border-b-2">
                <figure className="w-[48px] h-[48px] bg-cover">
                    <img src={link.thumbnail_url ?? ''} alt={link.title} />
                </figure>
                <h3 className="w-3/4 body my-auto mr-7">{link.title}</h3>
            </div>
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
                <div
                    className="absolute right-2 top-2 z-100"
                    onClick={(e) => void handleToggleAction('favorite', e)}
                >
                    <ULIComponent
                        tooltipClassName="absolute right-2 top-2 z-100"
                        iconClassName={`w-6 h-6 cursor-pointer ${link.is_favorited ? 'text-primary-yellow' : ''}`}
                        icon={link.is_favorited ? StarIcon : StarIconOutline}
                        dataTip="Favorite Helpful Link"
                    />
                </div>
            )}
            <div className="p-4 space-y-2">
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {link.description}
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
