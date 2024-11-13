import { useState } from 'react';
import { EditableResourceCollection } from '@/common';
import { useDebounceValue } from 'usehooks-ts';
import ResourceCollectionCardWithActions from './ResourceCollectionCardWithActions';

export default function SortableCollectionList({
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
}) {
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
}
