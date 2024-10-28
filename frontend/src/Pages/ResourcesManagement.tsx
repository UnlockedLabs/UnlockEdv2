import React, { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import useSWR from 'swr';
import Modal from '../Components/Modal';
import AddResourceCollectionForm from '../Components/forms/AddResourceCollectionForm';
import EditResourceCollectionForm from '../Components/forms/EditResourceCollectionForm';
import AddLinkForm from '../Components/forms/AddLinkForm';
import {
    ModalType,
    ResourceCategory,
    ResourceLink,
    ServerResponseMany,
    ToastState
} from '../common';
import { PencilSquareIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Bars3Icon, PlusIcon } from '@heroicons/react/24/solid';
import { CloudArrowUpIcon } from '@heroicons/react/16/solid';
import DeleteForm from '../Components/forms/DeleteForm';
import { useDebounceValue } from 'usehooks-ts';
import ExternalLink from '@/Components/ExternalLink';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { useToast } from '@/Context/ToastCtx.tsx';
import API from '@/api/api';

type EditableResourceCollection = ResourceCategory & {
    isModified: boolean;
};
export default function ResourcesManagement() {
    const { toaster } = useToast();
    const { data, error, mutate, isLoading } = useSWR<
        ServerResponseMany<ResourceCategory>,
        AxiosError
    >('/api/left-menu');

    const [collectionList, setCollectionList] = useState<
        EditableResourceCollection[]
    >([]);
    const [initialCollectionList, setInitialCollectionList] = useState<
        EditableResourceCollection[]
    >([]);
    const [collectionToDelete, setCollectionToDelete] = useState<
        number | undefined
    >();
    const [selectedCollectionIndex, setSelectedCollectionIndex] = useState<
        number | undefined
    >();
    const [originalLinkValues, setOriginalLinkValues] = useState<
        Record<number, ResourceLink>
    >({});
    const [hasDeletedCollection, setHasDeletedCollection] = useState(false);

    const addCollectionModal = useRef<HTMLDialogElement>(null);
    const deleteCollectionModal = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (data) {
            const updatedData = data.data.map((collection) => ({
                ...collection,
                id: Math.random(),
                isModified: false
            }));

            setHasDeletedCollection(false);
            setSelectedCollectionIndex(undefined);
            setCollectionList(updatedData);
            setInitialCollectionList(updatedData);
            setOriginalLinkValues({});
        }
    }, [data]);

    const handleCollectionClick = (collection: EditableResourceCollection) => {
        const collectionIndex = collectionList.findIndex(
            (c) => c.id === collection.id
        );
        setSelectedCollectionIndex(collectionIndex);

        // Store original values for all links in the collection
        const linkValues: Record<number, ResourceLink> = {};
        collection.links.forEach((link, index) => {
            linkValues[index] = { ...link };
        });
        setOriginalLinkValues(linkValues);
    };

    const handleDeleteCollectionClick = (collectionId: number) => {
        deleteCollectionModal.current?.showModal();
        setCollectionToDelete(collectionId);
    };

    const handleCollectionListReorder = (
        updatedCollectionList: EditableResourceCollection[]
    ) => {
        if (selectedCollectionIndex !== undefined) {
            const newSelectedCollectionIndex = updatedCollectionList.findIndex(
                (c) => c.id === collectionList[selectedCollectionIndex].id
            );
            setSelectedCollectionIndex(newSelectedCollectionIndex);
        }

        const isModified = !areCollectionsEqual(
            updatedCollectionList,
            initialCollectionList
        );
        const updatedList = updatedCollectionList.map((collection) => ({
            ...collection,
            isModified
        }));
        setCollectionList(updatedList);
    };

    const handleResourceLinkChange = (
        linkIndex: number,
        updatedResourceLink: ResourceLink
    ) => {
        if (selectedCollectionIndex !== undefined) {
            const updatedCollections = [...collectionList];
            const currentCollection =
                updatedCollections[selectedCollectionIndex];

            // Update the link
            updatedCollections[selectedCollectionIndex].links[linkIndex] =
                updatedResourceLink;

            // Compare current values with original values
            const originalLink = originalLinkValues[linkIndex];
            const [originalName, originalUrl] = Object.entries(originalLink)[0];
            const [newName, newUrl] = Object.entries(updatedResourceLink)[0];

            // Check if current values match original values
            const isLinkModified =
                originalName !== newName || originalUrl !== newUrl;

            // Check if any other links in the collection are modified
            const areOtherLinksModified = currentCollection.links.some(
                (link, idx) => {
                    if (idx === linkIndex) return false;
                    const [origName, origUrl] = Object.entries(
                        originalLinkValues[idx]
                    )[0];
                    const [currName, currUrl] = Object.entries(link)[0];
                    return origName !== currName || origUrl !== currUrl;
                }
            );

            // Update collection's modified status
            updatedCollections[selectedCollectionIndex].isModified =
                isLinkModified || areOtherLinksModified;

            setCollectionList(updatedCollections);
        }
    };

    const handleResourceCollectionChange = (
        updatedResourceCollection: EditableResourceCollection
    ) => {
        if (selectedCollectionIndex !== undefined) {
            const updatedCollections = [...collectionList];
            updatedCollections[selectedCollectionIndex] =
                updatedResourceCollection;
            setCollectionList(updatedCollections);
        }
    };

    const areCollectionsEqual = (
        list1: EditableResourceCollection[],
        list2: EditableResourceCollection[]
    ) => {
        if (list1.length !== list2.length) return false;
        return list1.every(
            (item, index) =>
                item.id === list2[index].id && item.rank === list2[index].rank
        );
    };

    const hasMadeModifications = () => {
        return hasDeletedCollection || collectionList.some((c) => c.isModified);
    };

    const addCollection = (
        collectionName: string,
        linkName: string,
        linkUrl: string
    ) => {
        const newCollection = {
            id: Math.random(),
            name: collectionName,
            links: [{ [linkName]: linkUrl }],
            rank: collectionList.length + 1,
            isModified: true
        };
        setCollectionList([...collectionList, newCollection]);
        addCollectionModal.current?.close();
    };

    const deleteCollection = (id: number | undefined) => {
        if (
            selectedCollectionIndex &&
            collectionList[selectedCollectionIndex].id === id
        ) {
            setSelectedCollectionIndex(undefined);
        }
        const newCollections = collectionList.filter((c) => c.id !== id);
        setHasDeletedCollection(true);
        setCollectionList(newCollections);
    };

    const updateFinalState = async (e: React.MouseEvent) => {
        e.preventDefault();
        const newCollectionList = collectionList.map((c, i) => {
            c.rank = i + 1;
            c.id = i;
            return c;
        });
        const response = await API.put<null, EditableResourceCollection[]>(
            'left-menu',
            newCollectionList
        );
        if (response.success) {
            await mutate();
            toaster('Collections Saved!', ToastState.success);

            setInitialCollectionList(newCollectionList);

            if (selectedCollectionIndex !== undefined) {
                const newOriginalValues: Record<number, ResourceLink> = {};
                newCollectionList[selectedCollectionIndex].links.forEach(
                    (link, index) => {
                        newOriginalValues[index] = { ...link };
                    }
                );
                setOriginalLinkValues(newOriginalValues);
            }

            setCollectionList(
                newCollectionList.map((c) => ({
                    ...c,
                    isModified: false
                }))
            );
        } else {
            toaster(
                'All collections must have associated links',
                ToastState.error
            );
        }
    };

    return (
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4 px-8">
                <h1>Resource Management</h1>
            </div>
            <div className="flex flex-row p-4 gap-x-8 h-full grow">
                {/* Full page */}
                <div className="flex flex-col gap-4 w-[300px]">
                    {/* Left pane */}
                    <div className="card flex flex-col px-8 py-4 grow">
                        {/* Card */}
                        <div className="flex justify-between">
                            {/* Card header */}
                            <h3 className="">Resources Preview</h3>
                            <div className="tooltip" data-tip="Add Collection">
                                <button
                                    className="btn btn-primary btn-circle btn-xs "
                                    data-tip="Add Collection"
                                    onClick={() =>
                                        addCollectionModal.current?.showModal()
                                    }
                                >
                                    <PlusIcon className="h-4 w-4 text-base-100" />
                                </button>
                            </div>
                        </div>
                        {/* Card body */}
                        {error ? (
                            <div>failed to load</div>
                        ) : isLoading ? (
                            <div>loading...</div>
                        ) : (
                            <SortableCollectionList
                                collections={collectionList}
                                selectedCollectionIndex={
                                    selectedCollectionIndex
                                }
                                onResourceCollectionClick={
                                    handleCollectionClick
                                }
                                onDeleteCollectionClick={
                                    handleDeleteCollectionClick
                                }
                                onUpdateCollectionList={
                                    handleCollectionListReorder
                                }
                            />
                        )}
                    </div>
                    <div className="flex justify-center">
                        <button
                            className="btn btn-primary btn-sm flex items-center justify-center space-x-2 text-white"
                            onClick={(e) => {
                                void updateFinalState(e);
                            }}
                            disabled={!hasMadeModifications()}
                        >
                            <CloudArrowUpIcon className="h-5 w-5" />
                            <span> Publish Changes</span>
                        </button>
                    </div>
                </div>
                <div className="card flex flex-col flex-grow gap-4 px-8 py-4">
                    {/* Right pane */}
                    <h3>Modify Collection</h3>
                    {selectedCollectionIndex !== undefined && (
                        <ResourceCollectionEditor
                            collection={collectionList[selectedCollectionIndex]}
                            onCollectionChange={handleResourceCollectionChange}
                            onResourceLinkChange={handleResourceLinkChange}
                        />
                    )}
                </div>
            </div>
            {/* Modals */}
            <Modal
                type={ModalType.Add}
                item="Collection"
                form={
                    <AddResourceCollectionForm
                        onSuccess={(
                            collectionName: string,
                            linkName: string,
                            linkUrl: string
                        ) => addCollection(collectionName, linkName, linkUrl)}
                    />
                }
                ref={addCollectionModal}
            />
            <Modal
                type={ModalType.Confirm}
                item="Delete Collection"
                form={
                    <DeleteForm
                        item="Collection"
                        onCancel={() => setCollectionToDelete(undefined)}
                        onSuccess={() => {
                            deleteCollection(collectionToDelete);
                            deleteCollectionModal.current?.close();
                        }}
                    />
                }
                ref={deleteCollectionModal}
            />
        </div>
    );
}

const SortableCollectionList = ({
    collections,
    selectedCollectionIndex,
    onResourceCollectionClick,
    onDeleteCollectionClick,
    onUpdateCollectionList
}: {
    collections: EditableResourceCollection[];
    selectedCollectionIndex: number | undefined;
    onResourceCollectionClick: (collection: EditableResourceCollection) => void;
    onDeleteCollectionClick: (collectionId: number) => void;
    onUpdateCollectionList: (newList: EditableResourceCollection[]) => void;
}) => {
    const [draggedItem, setDraggedItem] = useState<number>();
    const [draggedOverItem, setDraggedOverItem] = useState<
        undefined | number
    >();
    const dragOverItem = useDebounceValue(draggedOverItem, 100);

    const handleSort = () => {
        if (!draggedItem) return;

        const insertAtIndex = dragOverItem;

        // if dragged item is higher in the list, then should subtract a number from where it needs to be placed
        if (draggedItem && draggedItem < dragOverItem[0]!) {
            insertAtIndex[0] = insertAtIndex[0]! - 1;
        }

        const newCollectionList = [...collections];

        //Remove the dragged item from the list, save its content.
        const draggedItemContent = newCollectionList.splice(draggedItem, 1)[0];

        // Insert the dragged item into its new position
        if (insertAtIndex[0] === collections.length) {
            newCollectionList.push(draggedItemContent);
        } else {
            newCollectionList.splice(insertAtIndex[0]!, 0, draggedItemContent);
        }

        // Check to see which collections had their positions modified.
        const updatedCollectionList = newCollectionList.map(
            (collection, index) => {
                if (collection.id !== collections[index].id) {
                    return {
                        ...collection,
                        isModified: true
                    };
                }
                return collection;
            }
        );

        //update the actual array
        onUpdateCollectionList(updatedCollectionList);

        setDraggedItem(undefined);
        setDraggedOverItem(undefined);
    };

    const dragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        const source = e.dataTransfer.getData('text/plain');
        if (source === 'collection-list') {
            setDraggedOverItem(index);
        }
    };

    const dragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDraggedOverItem(undefined);
    };

    const dragDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const source = e.dataTransfer.getData('text/plain');
        if (source === 'collection-list') {
            handleSort();
        }
    };

    const dragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedItem(index);
        e.dataTransfer.setData('text/plain', 'collection-list');
    };

    const dragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (dragOverItem[0] == undefined) {
            setDraggedOverItem(-1);
        } else {
            handleSort();
        }
    };

    return collections.map((collection, index) => {
        return (
            <div
                key={index}
                className={`flex flex-col ${index === collections.length - 1 ? 'grow' : ''}`}
            >
                <div
                    className={
                        draggedItem == index
                            ? dragOverItem[0] == -1
                                ? 'block'
                                : 'hidden'
                            : 'block'
                    }
                >
                    <div
                        className={
                            dragOverItem[0] == index
                                ? 'pt-36 flex'
                                : 'pt-2 flex'
                        }
                        onDragOver={(e) => dragOver(e, index)}
                        onDragLeave={(e) => dragLeave(e)}
                        onDrop={(e) => dragDrop(e)}
                        onDragStart={(e) => dragStart(e, index)}
                        onDragEnd={(e) => dragEnd(e)}
                        draggable
                    >
                        <ResourceCollectionCardWithActions
                            collection={collection}
                            selected={index === selectedCollectionIndex}
                            onResourceCollectionClick={
                                onResourceCollectionClick
                            }
                            onDeleteCollectionClick={onDeleteCollectionClick}
                        />
                    </div>
                </div>

                {/* Render an empty div as a drop target for the end of the list. */}
                {index === collections.length - 1 ? (
                    <div
                        className="grow"
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDraggedOverItem(index + 1);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            setDraggedOverItem(undefined);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDraggedItem(index);
                        }}
                    ></div>
                ) : undefined}
            </div>
        );
    });
};

const ResourceCollectionCardWithActions = ({
    collection,
    selected,
    onResourceCollectionClick,
    onDeleteCollectionClick
}: {
    collection: EditableResourceCollection;
    selected: boolean;
    onResourceCollectionClick: (collection: EditableResourceCollection) => void;
    onDeleteCollectionClick: (collectionId: number) => void;
}) => {
    const cardClasses = `card card-compact grow overflow-visible ${collection.isModified ? 'bg-pale-yellow' : 'bg-inner-background'} ${selected ? 'border border-dark-yellow' : ''}`;

    return (
        <div
            className={cardClasses}
            onClick={() => onResourceCollectionClick(collection)}
        >
            <div className="card-body gap-2">
                <div className="flex justify-between">
                    <h3 className="card-title text-sm">{collection.name}</h3>
                    <ULIComponent
                        dataTip={'Delete Collection'}
                        iconClassName={'self-start cursor-pointer'}
                        onClick={() => onDeleteCollectionClick(collection.id)}
                        icon={TrashIcon}
                    />
                </div>
                {collection.links.map((link: ResourceLink, index: number) => {
                    const [title, url] = Object.entries(link)[0];
                    return (
                        <ExternalLink key={index} url={url}>
                            {title}
                        </ExternalLink>
                    );
                })}
            </div>
        </div>
    );
};

const ResourceCollectionEditor = ({
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
}) => {
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
};
