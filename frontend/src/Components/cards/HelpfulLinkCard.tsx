import { HelpfulLink, ModalType, ToastState, UserRole } from '@/common';
import API from '@/api/api';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { AdminRoles, useAuth } from '@/useAuth';
import { useToast } from '@/Context/ToastCtx';

export default function HelpfulLinkCard({
    link,
    showModal,
    role
}: {
    link: HelpfulLink;
    showModal?: (link: HelpfulLink, type: ModalType) => void;
    role?: UserRole;
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
            `/helpful-links/toggle/${link.id}`,
            {}
        );
        toaster(
            response.message,
            response.success ? ToastState.success : ToastState.error
        );
    };

    if (!user) {
        return null;
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
