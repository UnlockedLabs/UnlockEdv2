import CategoryItem from "@/Components/CategoryItem";
import PageNav from "@/Components/PageNav";
import Toast from "@/Components/Toast";
import AddCategoryForm from "@/Components/forms/AddCategoryForm";
import AddModal from "@/Components/modals/AddModal";
import DeleteModal from "@/Components/modals/DeleteModal";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Category, CategoryLink } from "@/common";
import { PageProps } from "@/types";
import { PlusCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

interface ToastProps {
    state: "success" | "error" | null;
    message: string;
}

export default function LeftMenuManagement({ auth }: PageProps) {
    const { data, error, mutate, isLoading } = useSWR("/api/v1/categories");

    const [categoryList, setCategoryList] = useState(Array<Category>);
    const [categoryToDelete, setCategoryToDelete] = useState<number | null>(
        null,
    );
    const addCategoryModal = useRef<null | HTMLDialogElement>(null);
    const deleteCategoryModal = useRef<null | HTMLDialogElement>(null);

    const [toast, setToast] = useState<ToastProps>({
        state: null,
        message: "",
    });

    const draggedItem = useRef<null | number>(null);
    const [dragOverItem, setDraggedOverItem] = useState<null | number>(null);

    useEffect(() => {
        if (data != undefined) {
            setCategoryList(data.data);
        }
    }, [data]);

    const MemoizedCategoryList = useMemo(() => {
        if (error) return <div>failed to load</div>;
        if (isLoading) return <div>loading...</div>;
        return categoryList.map((category, index) => {
            return (
                <div key={category.name.concat(category.id.toString())}>
                    <div
                        className={
                            draggedItem.current == index
                                ? dragOverItem == -1
                                    ? "block grow"
                                    : "hidden"
                                : "block grow"
                        }
                    >
                        <div
                            className={
                                dragOverItem == index
                                    ? "pt-36 flex"
                                    : "pt-6 flex"
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
                                if (dragOverItem == null)
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
            rank: categoryList.length + 1,
        };
        setCategoryList([...categoryList, newCategory]);
        addCategoryModal.current?.close();
    }

    function deleteCategory(id: number | null) {
        if (categoryToDelete == null) return;
        const newCategories = categoryList.filter(
            (category) => category.id !== id,
        );
        setCategoryList(newCategories);
    }

    function addLink(category: Category, newTitle: string, newURL: string) {
        let newLink: CategoryLink = {};
        newLink[newTitle] = newURL;
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                // add link to the category
                c.links.push(newLink);
                return c;
            } else return c;
        });
        setCategoryList(newCategoryList);
    }

    function deleteLink(category: Category, activeLinkToDelete: CategoryLink) {
        const newCategoryList = categoryList.map((c, i) => {
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
        direction: "up" | "down",
    ) {
        let index: number;
        if (direction == "up") {
            if (linkIndex == 0) return;
            index = linkIndex - 1;
        }
        if (direction == "down") {
            if (linkIndex == category.links.length - 1) return;
            index = linkIndex + 1;
        }
        const newCategoryList = categoryList.map((c, i) => {
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
        newLinkPair: any,
    ) {
        categoryList.map((c, i) => {
            if (c == category) {
                category.links[linkIndex] = newLinkPair;
                return c;
            } else return c;
        });
    }

    function handleSort() {
        if (draggedItem.current == null || dragOverItem == null) return;

        let insertAtIndex = dragOverItem;
        // if dragged item is higher in the list, then should subtract a number from where it needs to be placed
        if (draggedItem.current < dragOverItem)
            insertAtIndex = insertAtIndex - 1;

        //duplicate items
        let newCategoryList = [...categoryList];

        //remove and save the dragged item content
        const draggedItemContent = newCategoryList.splice(
            draggedItem.current,
            1,
        )[0];

        if (insertAtIndex == categoryList.length)
            newCategoryList.push(draggedItemContent);
        else newCategoryList.splice(insertAtIndex, 0, draggedItemContent);

        //update the actual array
        setCategoryList(newCategoryList);

        draggedItem.current = null;
        setDraggedOverItem(null);
    }

    async function updateFinalState(e: any) {
        setToast({ state: null, message: "" });
        e.preventDefault();
        const newCategoryList = categoryList.map((c, i) => {
            c.rank = i + 1;
            return c;
        });
        try {
            let response = await axios("/api/v1/categories", {
                method: "PUT",
                headers: { ContentType: "application/json" },
                data: newCategoryList,
            });
            // check response is okay, and give notification
            console.log(response);
            if (response.status !== 200) {
                // show error
                setToast({
                    state: "error",
                    message: "Error Saving Categories",
                });
            } else {
                mutate();
                // show success
                setToast({ state: "success", message: "Categories Saved!" });
            }
        } catch {
            // show error
            setToast({ state: "error", message: "Error Saving Categories" });
        }
    }

    return (
        <AuthenticatedLayout user={auth.user} title="Categories">
            <PageNav
                user={auth.user}
                path={["Settings", "Left Menu Management"]}
            />
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
            <DeleteModal
                item="Category"
                deleteFunction={() => {
                    deleteCategory(categoryToDelete),
                        deleteCategoryModal.current?.close();
                }}
                onClose={() => setCategoryToDelete(null)}
                ref={deleteCategoryModal}
            />
            <AddModal
                item="Category"
                addForm={
                    <AddCategoryForm
                        onSuccess={(title: string) => addCategory(title)}
                    />
                }
                ref={addCategoryModal}
            />
            {/* Toasts */}
            {toast.state !== null && (
                <Toast
                    state={toast.state}
                    message={toast.message}
                    reset={() => setToast({ state: null, message: "" })}
                />
            )}
        </AuthenticatedLayout>
    );
}
