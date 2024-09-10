import CategoryItem from '../Components/CategoryItem';
import Modal, { ModalType } from '../Components/Modal';
import Toast, { ToastState } from '../Components/Toast';
import AddCategoryForm from '../Components/forms/AddCategoryForm';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Category, CategoryLink, Resource } from '../common';
import { PlusCircleIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/24/solid';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import DeleteForm from '../Components/forms/DeleteForm';
import { useDebounceValue } from 'usehooks-ts';
import API from '@/api/api';

interface ToastProps {
    state: ToastState;
    message: string;
}

export default function ResourcesManagement() {
    const { data, error, mutate, isLoading } = useSWR('/api/left-menu');
    const [categoryList, setCategoryList] = useState(Array<Category>);
    const [categoryToDelete, setCategoryToDelete] = useState<number | null>(
        null
    );
    const addCategoryModal = useRef<null | HTMLDialogElement>(null);
    const deleteCategoryModal = useRef<null | HTMLDialogElement>(null);

    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });

    const draggedItem = useRef<null | number>(null);
    const [draggedOverItem, setDraggedOverItem] = useState<null | number>(null);
    const dragOverItem = useDebounceValue(draggedOverItem, 100);

    useEffect(() => {
        if (data !== undefined) {
            const updatedData = data.data.map(
                (category: Resource) =>
                    ({
                        ...category,
                        id: Math.random()
                    }) as Resource
            );
            setCategoryList(updatedData);
        }
    }, [data]);

    const MemoizedCategoryList = useMemo(() => {
        if (error) return <div>failed to load</div>;
        if (isLoading) return <div>loading...</div>;
        return categoryList.map((category, index) => {
            return (
                <div key={category.name.concat(index.toString())}>
                    <div
                        className={
                            draggedItem.current == index
                                ? dragOverItem[0] == -1
                                    ? 'block grow'
                                    : 'hidden'
                                : 'block grow'
                        }
                    >
                        <div
                            className={
                                dragOverItem[0] == index
                                    ? 'pt-36 flex'
                                    : 'pt-6 flex'
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
                                if (dragOverItem[0] == null)
                                    setDraggedOverItem(-1);
                                else handleSort();
                            }}
                        >
                            <div className="bg-neutral rounded-bl-lg rounded-tl-lg pl-3 h-15">
                                <TrashIcon
                                    className="w-4 mt-5 self-start text-base-100 cursor-pointer"
                                    onClick={() => {
                                        deleteCategoryModal.current?.showModal(),
                                            setCategoryToDelete(category.id);
                                    }}
                                />
                            </div>
                            <div className="grow">
                                <CategoryItem
                                    category={category}
                                    deleteLink={deleteLink}
                                    addLink={addLink}
                                    moveLink={moveLink}
                                    updateLink={updateLink}
                                />
                            </div>
                        </div>
                    </div>
                    {index == categoryList.length - 1 ? (
                        <div
                            className="h-screen"
                            onDragOver={(e) => {
                                e.preventDefault(),
                                    setDraggedOverItem(index + 1);
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
    }, [categoryList, dragOverItem]);

    function addCategory(newCategoryTitle: string) {
        const newCategory = {
            id: Math.random(),
            name: newCategoryTitle,
            links: [],
            rank: categoryList.length + 1
        };
        setCategoryList([...categoryList, newCategory]);
        addCategoryModal.current?.close();
    }

    function deleteCategory(id: number | null) {
        if (categoryToDelete == null) return;
        const newCategories = categoryList.filter(
            (category) => category.id !== id
        );
        setCategoryList(newCategories);
    }

    function addLink(category: Category, newTitle: string, newURL: string) {
        const newLink: CategoryLink = {};
        newLink[newTitle] = newURL;
        const newCategoryList = categoryList.map((c, _) => {
            if (c == category) {
                // add link to the category
                c.links.push(newLink);
                return c;
            } else return c;
        });
        setCategoryList(newCategoryList);
    }

    function deleteLink(category: Category, activeLinkToDelete: CategoryLink) {
        const newCategoryList = categoryList.map((c, _) => {
            if (c == category) {
                // delete link of the category
                c.links = c.links.filter((link) => link !== activeLinkToDelete);
                return c;
            } else return c;
        });
        setCategoryList(newCategoryList);
    }

    function moveLink(
        category: Category,
        linkIndex: number,
        direction: 'up' | 'down'
    ) {
        let index: number;
        if (direction == 'up') {
            if (linkIndex == 0) return;
            index = linkIndex - 1;
        }
        if (direction == 'down') {
            if (linkIndex == category.links.length - 1) return;
            index = linkIndex + 1;
        }
        const newCategoryList = categoryList.map((c, _) => {
            if (c == category) {
                const linksArray = c.links;
                const temp = linksArray[index];
                linksArray[index] = linksArray[linkIndex];
                linksArray[linkIndex] = temp;
                c.links = linksArray;
                return c;
            } else return c;
        });
        setCategoryList(newCategoryList);
    }

    function updateLink(
        category: Category,
        linkIndex: number,
        newLinkPair: CategoryLink
    ) {
        categoryList.map((c, _) => {
            if (c == category) {
                category.links[linkIndex] = newLinkPair;
                return c;
            } else return c;
        });
    }

    function handleSort() {
        if (draggedItem.current == null || dragOverItem == null) return;

        const insertAtIndex = dragOverItem;
        // if dragged item is higher in the list, then should subtract a number from where it needs to be placed
        if (draggedItem.current < dragOverItem[0]!)
            insertAtIndex[0] = insertAtIndex[0]! - 1;

        //duplicate items
        const newCategoryList = [...categoryList];

        //remove and save the dragged item content
        const draggedItemContent = newCategoryList.splice(
            draggedItem.current,
            1
        )[0];

        if (insertAtIndex[0] == categoryList.length)
            newCategoryList.push(draggedItemContent);
        else newCategoryList.splice(insertAtIndex[0]!, 0, draggedItemContent);

        //update the actual array
        setCategoryList(newCategoryList);

        draggedItem.current = null;
        setDraggedOverItem(null);
    }

    async function updateFinalState(e: React.MouseEvent) {
        setToast({ state: ToastState.null, message: '' });
        e.preventDefault();
        const newCategoryList = categoryList.map((c, i) => {
            c.rank = i + 1;
            c.id = i;
            return c;
        });
        const response = await API.put('left-menu', newCategoryList);
        // check response is okay, and give notification
        if (!response.success) {
            // show error
            setToast({
                state: ToastState.error,
                message: 'Error Saving Categories'
            });
        } else {
            mutate();
            // show success
            setToast({
                state: ToastState.success,
                message: 'Categories Saved!'
            });
        }
    }

    return (
        <AuthenticatedLayout title="Categories" path={['Resource Management']}>
            <div className="p-4">
                <div className="flex justify-between">
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => addCategoryModal.current?.showModal()}
                    >
                        <PlusCircleIcon className="h-4 text-base-100" />
                        <span className="text-base-100">Add Category</span>
                    </button>
                    <div className="tooltip tooltip-left" data-tip="Save">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => updateFinalState(e)}
                        >
                            <DocumentCheckIcon className="h-4 text-base-100" />
                        </button>
                    </div>
                </div>
                <div>{MemoizedCategoryList}</div>
            </div>
            {/* Modals */}
            <Modal
                type={ModalType.Add}
                item="Category"
                form={
                    <AddCategoryForm
                        onSuccess={(title: string) => addCategory(title)}
                    />
                }
                ref={addCategoryModal}
            />
            <Modal
                type={ModalType.Confirm}
                item="Delete Category"
                form={
                    <DeleteForm
                        item="Category"
                        onCancel={() => setCategoryToDelete(null)}
                        onSuccess={() => {
                            deleteCategory(categoryToDelete),
                                deleteCategoryModal.current?.close();
                        }}
                    />
                }
                ref={deleteCategoryModal}
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
