import { HelpfulLink, ModalType } from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import AddLinkForm from '@/Components/forms/AddLinkForm';
import EditLinkForm from '@/Components/forms/EditLinkForm';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Modal from '@/Components/Modal';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';

const helpfulLinks: HelpfulLink[] = [
    {
        id: 1,
        name: 'Unlocked Labs Website Website ',
        url: 'www.unlockedlabs.org',
        description:
            'description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs ',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: true
    },
    {
        id: 2,
        name: 'Unlocked Labs LinkedIn',
        url: 'https://www.linkedin.com/company/labs-unlocked/',
        description: 'description of unlocked labs',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: false
    }
];

export default function HelpfulLinksManagement() {
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const editLinkModal = useRef<HTMLDialogElement>(null);
    const [currentLink, setCurrentLink] = useState<HelpfulLink>();

    // grab the data

    function updateLinks() {
        // api put request
        // close modal
    }

    function showEditLink(link: HelpfulLink) {
        setCurrentLink(link);
        editLinkModal.current?.showModal();
    }

    return (
        <div className="w-full flex flex-col gap-8">
            <div className="flex flex-row justify-between">
                {/* searcha nd sort */}
                {/* TO DO: make this a common enum? */}
                <DropdownControl
                    enumType={{
                        'Date Added ↓': 'created_at DESC',
                        'Date Added ↑': 'created_at ASC',
                        'Title (A-Z)': 'title ASC',
                        'Title (Z-A)': 'title DESC'
                    }}
                />
                {/* add links button */}
                <div
                    className="button my-auto"
                    onClick={() => {
                        addLinkModal.current?.showModal();
                    }}
                >
                    <PlusCircleIcon className="w-4 my-auto" />
                    Add Link
                </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
                {/* map through the helpful links */}
                {helpfulLinks.map((link: HelpfulLink, index: number) => {
                    return (
                        <HelpfulLinkCard
                            key={index}
                            link={link}
                            showEditLink={showEditLink}
                        />
                    );
                })}
            </div>
            {/* Modals */}
            <Modal
                ref={addLinkModal}
                type={ModalType.Add}
                item={'Helpful Link'}
                form={<AddLinkForm onSuccess={updateLinks} />}
            />
            <Modal
                ref={editLinkModal}
                type={ModalType.Edit}
                item={'Helpful Link'}
                form={
                    currentLink ? (
                        <EditLinkForm
                            link={currentLink}
                            onSuccess={updateLinks}
                        />
                    ) : (
                        <div>No link selected!</div>
                    )
                }
            />
        </div>
    );
}
