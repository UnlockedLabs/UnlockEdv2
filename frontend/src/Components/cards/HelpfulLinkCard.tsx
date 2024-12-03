import { HelpfulLink, ModalType, ToastState } from '@/common';
import API from '@/api/api';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { useToast } from '@/Context/ToastCtx';

export default function HelpfulLinkCard({
    link,
    showModal
}: {
    link: HelpfulLink;
    showModal: (link: HelpfulLink, type: ModalType) => void;
}) {
    const [visible, setVisible] = useState<boolean>(link.visibility_status);
    const { toaster } = useToast();
    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleVisibility();
        }
    }

    console.log(link.id);
    console.log('whole link: ', link);
    const handleToggleVisibility = async () => {
        const response = await API.put<null, object>(
            `/helpful-links/toggle/${link.id}`,
            {}
        );
        if (response.success) {
            toaster(response.message, ToastState.success);
        } else {
            toaster(response.message, ToastState.error);
        }
    };

    return (
        <div className="card p-4 space-y-2">
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
            <h3 className="body">{link.name}</h3>
            <p className="body line-clamp-2 h-10">{link.description}</p>
            <VisibleHiddenToggle
                visible={visible}
                changeVisibility={changeVisibility}
            />
        </div>
    );
}
