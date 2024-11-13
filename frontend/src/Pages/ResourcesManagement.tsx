import React, { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import useSWR from 'swr';
import Modal from '../Components/Modal';
import AddResourceCollectionForm from '../Components/forms/AddResourceCollectionForm';
import {
    ModalType,
    ResourceCategory,
    ResourceLink,
    ServerResponseMany,
    ToastState
} from '../common';

import { CloudArrowUpIcon, PlusIcon } from '@heroicons/react/16/solid';
import DeleteForm from '../Components/forms/DeleteForm';
import { useToast } from '@/Context/ToastCtx.tsx';
import API from '@/api/api';
import SortableCollectionList from '@/Components/resourceMgtHelpers/SortableCollectionList';
import ResourceCollectionEditor from '@/Components/resourceMgtHelpers/ResourceCollectionEditor';

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
