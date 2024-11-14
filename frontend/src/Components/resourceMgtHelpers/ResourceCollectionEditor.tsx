import { useRef, useState } from 'react';
import { EditableResourceCollection, ResourceLink, ModalType } from '@/common';
import ULIComponent from '@/Components/ULIComponent.tsx';
import {
    TrashIcon,
    PencilSquareIcon,
    PlusCircleIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon } from '@heroicons/react/24/solid';
import Modal from '@/Components/Modal';
import DeleteForm from '../DeleteForm';
import AddLinkForm from '../forms/AddLinkForm';
import EditResourceCollectionForm from '../forms/EditResourceCollectionForm';

export default function ResourceCollectionEditor({
    collection,
    onCollectionChange,
    onResourceLinkChange
}: {
    collection: EditableResourceCollection;
    onCollectionChange: (updatedCollection: EditableResourceCollection) => void;
    onResourceLinkChange: (
        linkIndex: number,
        updatedResourceLink: ResourceLink
    ) => void;
}) {
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const deleteLinkModal = useRef<HTMLDialogElement>(null);
    const editResourceCollectionModal = useRef<HTMLDialogElement>(null);
    const [activeLinkToDelete, setActiveLinkToDelete] = useState<
        number | undefined
    >();

    const [draggedItem, setDraggedItem] = useState<number | undefined>();
    const [draggedOverItem, setDraggedOverItem] = useState<
        number | undefined
    >();

    const editCollectionTitle = (newtitle: string) => {
        onCollectionChange({
            ...collection,
            name: newtitle,
            isModified: true
        });
    };

    const addLink = (
        collection: EditableResourceCollection,
        title: string,
        url: string
    ) => {
        onCollectionChange({
            ...collection,
            links: [...collection.links, { [title]: url }],
            isModified: true
        });
    };

    const deleteLink = (
        collection: EditableResourceCollection,
        linkIndex: number
    ) => {
        onCollectionChange({
            ...collection,
            links: collection.links.filter((_, index) => index !== linkIndex),
            isModified: true
        });
    };

    const handleSort = () => {
        if (!draggedItem || !draggedOverItem) return;

        // Check to see if dragged item stayed in the same position
        if (draggedItem === draggedOverItem) return;

        const newLinks = [...collection.links];
        const draggedLink = newLinks.splice(draggedItem, 1)[0];
        newLinks.splice(draggedOverItem, 0, draggedLink);

        onCollectionChange({
            ...collection,
            links: newLinks,
            isModified: true
        });

        setDraggedItem(undefined);
        setDraggedOverItem(undefined);
    };

    return (
        <div className="card bg-inner-background">
            <div className="card-body gap-2">
                <div className="flex justify-between">
                    <h3 className="card-title text-sm">{collection.name}</h3>
                    <div className={'space-x-2'}>
                        <ULIComponent
                            iconClassName={'self-start cursor-pointer'}
                            dataTip={'Edit Collection'}
                            onClick={() =>
                                editResourceCollectionModal.current?.showModal()
                            }
                            icon={PencilSquareIcon}
                        />

                        <ULIComponent
                            iconClassName={'self-start cursor-pointer'}
                            tooltipClassName={'self-start mr-2'}
                            dataTip={'New Link'}
                            onClick={() => addLinkModal.current?.showModal()}
                            icon={PlusCircleIcon}
                        />
                    </div>
                </div>
                <table className="table">
                    <thead>
                        <tr className="border-grey-3">
                            <th className="w-4"></th>
                            <th>Link Name</th>
                            <th>Link URL</th>
                            <th className="w-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {collection.links.map(
                            (link: ResourceLink, linkIndex: number) => {
                                const [title, url] = Object.entries(link)[0];
                                return (
                                    <tr
                                        key={linkIndex}
                                        draggable={draggedItem !== null}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDraggedOverItem(linkIndex);
                                        }}
                                        onDrop={handleSort}
                                        onDragEnd={handleSort}
                                        className={
                                            draggedItem === linkIndex
                                                ? 'bg-grey-1'
                                                : ''
                                        }
                                    >
                                        <td>
                                            <ULIComponent
                                                onMouseDown={() =>
                                                    setDraggedItem(linkIndex)
                                                }
                                                icon={Bars3Icon}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="input input-bordered w-full"
                                                value={title}
                                                onChange={(e) => {
                                                    onResourceLinkChange(
                                                        linkIndex,
                                                        {
                                                            [e.target.value]:
                                                                url
                                                        }
                                                    );
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="input input-bordered w-full"
                                                value={url}
                                                onChange={(e) =>
                                                    onResourceLinkChange(
                                                        linkIndex,
                                                        {
                                                            [title]:
                                                                e.target.value
                                                        }
                                                    )
                                                }
                                            />
                                        </td>
                                        <td>
                                            <ULIComponent
                                                iconClassName={
                                                    'self-start cursor-pointer'
                                                }
                                                dataTip={'Delete Link'}
                                                onClick={() => {
                                                    setActiveLinkToDelete(
                                                        linkIndex
                                                    );
                                                    deleteLinkModal.current?.showModal();
                                                }}
                                                icon={TrashIcon}
                                            />
                                        </td>
                                    </tr>
                                );
                            }
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                type={ModalType.Add}
                item="Link"
                form={
                    <AddLinkForm
                        onSuccess={(title: string, url: string) => {
                            addLink(collection, title, url);
                            addLinkModal.current?.close();
                        }}
                    />
                }
                ref={addLinkModal}
            />
            <Modal
                type={ModalType.Confirm}
                item="Delete Link"
                form={
                    <DeleteForm
                        item="Link"
                        onCancel={() => setActiveLinkToDelete(undefined)}
                        onSuccess={() =>
                            activeLinkToDelete != undefined &&
                            deleteLink(collection, activeLinkToDelete)
                        }
                    />
                }
                ref={deleteLinkModal}
            />
            <Modal
                type={ModalType.Edit}
                item="Collection Name"
                form={
                    <EditResourceCollectionForm
                        collectionName={collection.name}
                        onSuccess={(newTitle: string) => {
                            editCollectionTitle(newTitle);
                            editResourceCollectionModal.current?.close();
                        }}
                    />
                }
                ref={editResourceCollectionModal}
            />
        </div>
    );
}
