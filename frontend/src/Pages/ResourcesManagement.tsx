import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import Modal, { ModalType } from '../Components/Modal';
import Toast, { ToastState } from '../Components/Toast';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AddResourceCollectionForm from '../Components/forms/AddResourceCollectionForm';
import EditResourceCollectionForm from '../Components/forms/EditResourceCollectionForm';
import AddLinkForm from '../Components/forms/AddLinkForm';
import { ResourceCategory, ResourceLink } from '../common';
import { PlusCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/24/outline';
import { PlusIcon, Bars3Icon } from '@heroicons/react/24/solid';
import { CloudArrowUpIcon } from '@heroicons/react/16/solid';
import DeleteForm from '../Components/forms/DeleteForm';
import { useDebounceValue } from 'usehooks-ts';
import ExternalLink from '@/Components/ExternalLink';

interface ToastProps {
    state: ToastState;
    message: string;
}

type EditableResourceCollection = ResourceCategory & {
    isModified: boolean;
};

export default function ResourcesManagement() {
    const { data, error, mutate, isLoading } = useSWR('/api/left-menu');

    const [collectionList, setCollectionList] = useState([]);
    const [collectionToDelete, setCollectionToDelete] = useState<number | null>(
        null
    );
    const [selectedCollectionIndex, setSelectedCollectionIndex] = useState<
        number | null
    >(null);
    const [hasDeletedCollection, setHasDeletedCollection] = useState(false);
    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });

    const addCollectionModal = useRef<null | HTMLDialogElement>(null);
    const deleteCollectionModal = useRef<null | HTMLDialogElement>(null);

    useEffect(() => {
        if (data !== undefined) {
            const updatedData = data.data.map(
                (collection: EditableResourceCollection) => ({
                    ...collection,
                    id: Math.random(),
                    isModified: false
                })
            );

            setHasDeletedCollection(false);
            setSelectedCollectionIndex(null);
            setCollectionList(updatedData);
        }
    }, [data]);

    const handleCollectionClick = (collection: EditableResourceCollection) => {
        setSelectedCollectionIndex(
            collectionList.findIndex((c) => c.id === collection.id)
        );
    };

    const handleDeleteCollectionClick = (collectionId: number) => {
        deleteCollectionModal.current?.showModal();
        setCollectionToDelete(collectionId);
    };

    const handleCollectionListReorder = (
        updatedCollectionList: EditableResourceCollection[]
    ) => {
        // Retain selected collection (even if it was reordered)
        if (selectedCollectionIndex !== null) {
            const newSelectedCollectionIndex = updatedCollectionList.findIndex(
                (c) => c.id === collectionList[selectedCollectionIndex].id
            );
            setSelectedCollectionIndex(newSelectedCollectionIndex);
        }

        setCollectionList(updatedCollectionList);
    };

    const handleResourceLinkChange = (
        linkIndex: number,
        updatedResourceLink: ResourceLink
    ) => {
        if (selectedCollectionIndex !== null) {
            const updatedCollections = [...collectionList];
            updatedCollections[selectedCollectionIndex].links[linkIndex] =
                updatedResourceLink;
            updatedCollections[selectedCollectionIndex].isModified = true;
            setCollectionList(updatedCollections);
        }
    };

    const handleResourceCollectionChange = (
        updatedResourceCollection: EditableResourceCollection
    ) => {
        if (selectedCollectionIndex !== null) {
            const updatedCollections = [...collectionList];
            updatedCollections[selectedCollectionIndex] =
                updatedResourceCollection;
            setCollectionList(updatedCollections);
        }
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
            links: [{ [linkName]: linkUrl }], // Use linkName as the key
            rank: collectionList.length + 1,
            isModified: true
        };
        setCollectionList([...collectionList, newCollection]);
        addCollectionModal.current?.close();
    };

    const deleteCollection = (id: number | null) => {
        if (
            selectedCollectionIndex !== null &&
            collectionList[selectedCollectionIndex].id === id
        ) {
            setSelectedCollectionIndex(null);
        }
        const newCollections = collectionList.filter((c) => c.id !== id);
        setHasDeletedCollection(true);
        setCollectionList(newCollections);
    };

    const updateFinalState = async (e: any) => {
        setToast({ state: ToastState.null, message: '' });
        e.preventDefault();
        const newCollectionList = collectionList.map((c, i) => {
            c.rank = i + 1;
            c.id = i;
            return c;
        });
        try {
            const response = await axios.put(
                '/api/left-menu',
                newCollectionList
            );
            // check response is okay, and give notification
            if (response.status !== 201) {
                // show error
                setToast({
                    state: ToastState.error,
                    message: 'Error Saving Collections'
                });
            } else {
                mutate();
                // show success
                setToast({
                    state: ToastState.success,
                    message: 'Collections Saved!'
                });
            }
        } catch (err: any) {
            console.log(err);
            if (err.response.status == 422) {
                setToast({
                    state: ToastState.error,
                    message: 'All collections must have associated links'
                });
            } else {
                // show general error
                setToast({
                    state: ToastState.error,
                    message: 'Error Saving Collections'
                });
            }
        }
    };

    return (
        <AuthenticatedLayout title="Collections" path={['Resource Management']}>
            <div className="flex flex-row p-4 gap-x-8 h-full grow">
                {' '}
                {/* Full page */}
                <div className="flex flex-col gap-4 w-[300px]">
                    {' '}
                    {/* Left pane */}
                    <div className="card flex flex-col px-8 py-4 grow">
                        {' '}
                        {/* Card */}
                        <div className="flex justify-between">
                            {' '}
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
                            onClick={(e) => updateFinalState(e)}
                            disabled={!hasMadeModifications()}
                        >
                            <CloudArrowUpIcon className="h-5 w-5" />
                            <span>Publish Changes</span>
                        </button>
                    </div>
                </div>
                <div className="card flex flex-col flex-grow gap-4 px-8 py-4">
                    {' '}
                    {/* Right pane */}
                    <h3>Modify Collection</h3>
                    {selectedCollectionIndex !== null && (
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
                        onCancel={() => setCollectionToDelete(null)}
                        onSuccess={() => {
                            deleteCollection(collectionToDelete),
                                deleteCollectionModal.current?.close();
                        }}
                    />
                }
                ref={deleteCollectionModal}
            />
            {/* Toasts */}
            {toast.state !== ToastState.null && (
                <Toast
                    state={toast.state}
                    message={toast.message}
                    reset={() =>
                        setToast({ state: ToastState.null, message: '' })
                    }
                />
            )}
        </AuthenticatedLayout>
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
    selectedCollectionIndex: number | null;
    onResourceCollectionClick: (collection: EditableResourceCollection) => void;
    onDeleteCollectionClick: (collectionId: number) => void;
    onUpdateCollectionList: (newList: EditableResourceCollection[]) => void;
}) => {
    const draggedItem = useRef<null | number>(null);
    const [draggedOverItem, setDraggedOverItem] = useState<null | number>(null);
    const dragOverItem = useDebounceValue(draggedOverItem, 100);

    const handleSort = () => {
        if (draggedItem.current == null || dragOverItem == null) return;

        const insertAtIndex = dragOverItem;

        // if dragged item is higher in the list, then should subtract a number from where it needs to be placed
        if (draggedItem.current < dragOverItem[0]!) {
            insertAtIndex[0] = insertAtIndex[0]! - 1;
        }

        const newCollectionList = [...collections];

        //Remove the dragged item from the list, save its content.
        const draggedItemContent = newCollectionList.splice(
            draggedItem.current,
            1
        )[0];

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

        draggedItem.current = null;
        setDraggedOverItem(null);
    };

    return collections.map((collection, index) => {
        return (
            <div
                key={collection.name.concat(index.toString())}
                className={`flex flex-col ${index === collections.length - 1 ? 'grow' : ''}`}
            >
                <div
                    className={
                        draggedItem.current == index
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
                        onDragOver={(e) => {
                            e.preventDefault(), setDraggedOverItem(index);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault(), setDraggedOverItem(null);
                        }}
                        onDrop={(e) => {
                            e.preventDefault(), draggedItem.current == null;
                        }}
                        onDragStart={() => (draggedItem.current = index)}
                        onDragEnd={(e) => {
                            e.preventDefault();
                            if (dragOverItem[0] == null) setDraggedOverItem(-1);
                            else handleSort();
                        }}
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
                {index == collections.length - 1 ? (
                    <div
                        className="grow"
                        onDragOver={(e) => {
                            e.preventDefault(), setDraggedOverItem(index + 1);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault(), setDraggedOverItem(null);
                        }}
                        onDrop={(e) => {
                            e.preventDefault(), draggedItem.current == null;
                        }}
                    ></div>
                ) : null}
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
    const cardClasses = `card card-compact grow overflow-visible ${collection.isModified ? 'bg-pale-yellow' : ''} ${selected ? 'border border-dark-yellow' : ''}`;

    return (
        <div
            className={cardClasses}
            onClick={() => onResourceCollectionClick(collection)}
        >
            <div className="card-body gap-2">
                <div className="flex justify-between">
                    <h3 className="card-title text-sm">{collection.name}</h3>
                    <div className="tooltip" data-tip="Delete Collection">
                        <TrashIcon
                            className="w-4 h-4 self-start cursor-pointer"
                            onClick={() =>
                                onDeleteCollectionClick(collection.id)
                            }
                        />
                    </div>
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
    const addLinkModal = useRef<null | HTMLDialogElement>(null);
    const deleteLinkModal = useRef<null | HTMLDialogElement>(null);
    const editResourceCollectionModal = useRef<null | HTMLDialogElement>(null);
    const [activeLinkToDelete, setActiveLinkToDelete] = useState<number | null>(
        null
    );

    const [draggedItem, setDraggedItem] = useState<number | null>(null);
    const [draggedOverItem, setDraggedOverItem] = useState<number | null>(null);

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
        if (draggedItem === null || draggedOverItem === null) return;

        const newLinks = [...collection.links];
        const draggedLink = newLinks.splice(draggedItem, 1)[0];
        newLinks.splice(draggedOverItem, 0, draggedLink);

        onCollectionChange({
            ...collection,
            links: newLinks,
            isModified: true
        });

        setDraggedItem(null);
        setDraggedOverItem(null);
    };

    return (
        <div className="card">
            <div className="card-body gap-2">
                <div className="flex justify-between">
                    <h3 className="card-title text-sm">{collection.name}</h3>
                    <div
                        className="tooltip ml-auto mr-2"
                        data-tip="Edit Collection"
                    >
                        <PencilSquareIcon
                            className="w-4 h-4 cursor-pointer"
                            onClick={() =>
                                editResourceCollectionModal.current?.showModal()
                            }
                        />
                    </div>
                    <div
                        className="tooltip self-start mr-2"
                        data-tip="New Link"
                    >
                        <PlusCircleIcon
                            className="w-4 h-4 cursor-pointer"
                            onClick={() => addLinkModal.current?.showModal()}
                        />
                    </div>
                </div>
                <table className="table">
                    <thead>
                        <tr className="border-grey-600">
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
                                                ? 'bg-gray-200'
                                                : ''
                                        }
                                    >
                                        <td>
                                            <Bars3Icon
                                                className="w-4 h-4"
                                                onMouseDown={() =>
                                                    setDraggedItem(linkIndex)
                                                }
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
                                            <div
                                                className="tooltip"
                                                data-tip="Delete Link"
                                            >
                                                <TrashIcon
                                                    className="w-4 h-4 cursor-pointer"
                                                    onClick={() => {
                                                        setActiveLinkToDelete(
                                                            linkIndex
                                                        );
                                                        deleteLinkModal.current?.showModal();
                                                    }}
                                                />
                                            </div>
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
                            addLink(collection, title, url),
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
                        onCancel={() => setActiveLinkToDelete(null)}
                        onSuccess={() =>
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
                            editCollectionTitle(newTitle),
                                editResourceCollectionModal.current?.close();
                        }}
                    />
                }
                ref={editResourceCollectionModal}
            />
        </div>
    );
};
