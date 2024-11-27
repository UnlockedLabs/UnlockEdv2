import { HelpfulLink } from '@/common';
import VisibleHiddenToggle from '../VisibleHiddenToggle';
import { useState } from 'react';
import ULIComponent from '../ULIComponent';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function HelpfulLinkCard({
    link,
    showEditLink
}: {
    link: HelpfulLink;
    showEditLink: () => void;
}) {
    const [visible] = useState(link.visibility_status);
    function changeVisibility() {
        // api put call
        return;
    }
    return (
        <div className="card p-4 space-y-2">
            <div className="flex flex-row gap-2 justify-end">
                <ULIComponent icon={PencilSquareIcon} onClick={showEditLink} />
                <ULIComponent icon={TrashIcon} />
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
