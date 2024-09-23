import { ResourceCategory, ResourceLink } from '@/common';
import { useRef, useState } from 'react';
import LinkItem from './LinkItem';
import AddLinkForm from '@/Components/forms/AddLinkForm';

import {
    ChevronDownIcon,
    ChevronRightIcon,
    TrashIcon,
    PlusIcon,
    ChevronUpIcon
} from '@heroicons/react/24/solid';
import Modal, { ModalType } from './Modal';
import DeleteForm from './forms/DeleteForm';

export default function CategoryItem({
    category,
    deleteLink,
    addLink,
    moveLink,
    updateLink
}: {
    category: ResourceCategory;
    deleteLink: Function;
    addLink: Function;
    moveLink: Function;
    updateLink: Function;
}) {
    const [activeLinkToDelete, setActiveLinkToDelete] =
        useState<ResourceLink | null>(null);
    const [open, setOpen] = useState(true);
    const deleteLinkModal = useRef<null | HTMLDialogElement>(null);
    const addLinkModal = useRef<null | HTMLDialogElement>(null);

    return (
        <details open>
            <summary
                draggable
                className="flex flex-cols-3 justify-between text-base-100 font-bold bg-neutral p-4 rounded-br-lg rounded-tr-lg"
                onClick={() => setOpen(!open)}
            >
                <div></div>
                {category.name}
                {open ? (
                    <ChevronDownIcon className="w-4 cursor-pointer" />
                ) : (
                    <ChevronRightIcon className="w-4 cursor-pointer" />
                )}
            </summary>
            <ul className="card p-4 gap-y-2 rounded-bl-none">
                <div className="flex flex-cols-2 font-bold gap-2 pr-6">
                    <h3 className="w-1/3">Title</h3>
                    <h3 className="w-2/3">URL</h3>
                </div>
                {category.links.map((linkPair: ResourceLink, index) => {
                    const key = Object.keys(linkPair)[0];
                    return (
                        <div
                            className="flex flex-row justify-between gap-2"
                            key={linkPair[key].concat(index.toString())}
                        >
                            <LinkItem
                                linkName={key}
                                linkURL={linkPair[key]}
                                callUpdateLink={(newLinkPair: ResourceLink) =>
                                    updateLink(category, index, newLinkPair)
                                }
                            />
                            <div
                                className="tooltip my-auto"
                                data-tip="Delete Link"
                            >
                                <TrashIcon
                                    className="w-4 cursor-pointer"
                                    onClick={() => {
                                        setActiveLinkToDelete(linkPair),
                                            deleteLinkModal.current?.showModal();
                                    }}
                                />
                            </div>
                            <div
                                className="tooltip my-auto"
                                data-tip="Move Link Up"
                            >
                                <ChevronUpIcon
                                    className="w-5 cursor-pointer"
                                    onClick={() =>
                                        moveLink(category, index, 'up')
                                    }
                                />
                            </div>
                            <div
                                className="tooltip my-auto"
                                data-tip="Move Link Down"
                            >
                                <ChevronDownIcon
                                    className="w-5 cursor-pointer"
                                    onClick={() =>
                                        moveLink(category, index, 'down')
                                    }
                                />
                            </div>
                        </div>
                    );
                })}
                <button
                    className="btn btn-active bg-base-200 w-full p-2"
                    onClick={() => addLinkModal.current?.showModal()}
                >
                    <PlusIcon className="w-6 mx-auto" />
                </button>
            </ul>
            {/* Modals */}
            <Modal
                type={ModalType.Confirm}
                item="Delete Link"
                form={
                    <DeleteForm
                        item="Link"
                        onCancel={() => setActiveLinkToDelete(null)}
                        onSuccess={() =>
                            deleteLink(category, activeLinkToDelete)
                        }
                    />
                }
                ref={deleteLinkModal}
            />
            <Modal
                type={ModalType.Add}
                item="Link"
                form={
                    <AddLinkForm
                        onSuccess={(title: string, url: string) => {
                            addLink(category, title, url),
                                addLinkModal.current?.close();
                        }}
                    />
                }
                ref={addLinkModal}
            />
        </details>
    );
}
