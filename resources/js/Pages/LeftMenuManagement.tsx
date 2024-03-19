import PageNav from "@/Components/PageNav";
import AddCategoryForm from "@/Components/forms/AddCategoryForm";
import AddLinkForm from "@/Components/forms/AddLinkForm";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Category, CategoryLink } from "@/common";
import { PageProps } from "@/types";
import {
    PlusCircleIcon,
    DocumentCheckIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import {
    ChevronDownIcon,
    TrashIcon,
    PlusIcon,
    ChevronUpIcon,
} from "@heroicons/react/24/solid";
import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

function LinkItem({
    linkName,
    linkURL,
    callUpdateLink,
}: {
    linkName: string;
    linkURL: string;
    callUpdateLink: any;
}) {
    const [name, setName] = useState(linkName);
    const [url, setURL] = useState(linkURL);

    return (
        <li className="flex flex-cols-2 gap-2 w-full">
            <input
                type="text"
                defaultValue={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                    let newLinkPair: CategoryLink = {};
                    newLinkPair[name] = url;
                    callUpdateLink(newLinkPair);
                }}
                className="input input-bordered w-1/3"
            />
            <input
                type="text"
                defaultValue={url}
                onChange={(e) => setURL(e.target.value)}
                onBlur={() => {
                    let newLinkPair: CategoryLink = {};
                    newLinkPair[name] = url;
                    callUpdateLink(newLinkPair);
                }}
                className="input input-bordered w-2/3"
            />
        </li>
    );
}

function CategoryItem({
    category,
    deleteLink,
    addLink,
    moveLinkUp,
    moveLinkDown,
    updateLink,
}: {
    category: Category;
    deleteLink: any;
    addLink: any;
    moveLinkUp: any;
    moveLinkDown: any;
    updateLink: any;
}) {
    const [activeLinkToDelete, setActiveLinkToDelete] = useState({ "": "" });
    const deleteLinkModal = useRef<null | HTMLDialogElement>(null);
    const addLinkModal = useRef<null | HTMLDialogElement>(null);

    function openDeleteLinkModal(linkPair: any) {
        setActiveLinkToDelete(linkPair);
        deleteLinkModal.current?.showModal();
    }

    function LinkRow({
        linkPair,
        index,
        keyString,
    }: {
        linkPair: { [x: string]: string };
        index: number;
        keyString: string;
    }) {
        function callUpdateLink(newLinkPair: CategoryLink) {
            updateLink(category, index, newLinkPair);
        }

        return (
            <div className="flex flex-row justify-between gap-2">
                <LinkItem
                    linkName={keyString}
                    linkURL={linkPair[keyString]}
                    callUpdateLink={callUpdateLink}
                />
                <TrashIcon
                    className="w-4 cursor-pointer"
                    onClick={() => openDeleteLinkModal(linkPair)}
                />
                <ChevronUpIcon
                    className="w-5 cursor-pointer"
                    onClick={() => moveLinkUp(category, index)}
                />
                <ChevronDownIcon
                    className="w-5 cursor-pointer"
                    onClick={() => moveLinkDown(category, index)}
                />
            </div>
        );
    }

    return (
        <details open>
            <summary
                draggable
                className="flex flex-cols-3 justify-between text-base-100 font-bold bg-neutral p-4 rounded-br-lg rounded-tr-lg"
            >
                <div></div>
                {category.name}
                <ChevronDownIcon className="w-4 cursor-pointer" />
            </summary>
            <ul className="card p-4 gap-y-2 rounded-bl-none">
                <div className="flex flex-cols-2 font-bold gap-2 pr-6">
                    <h3 className="w-1/3">Title</h3>
                    <h3 className="w-2/3">URL</h3>
                </div>
                {category.links.map(
                    (linkPair: { [x: string]: string }, index) => {
                        const key = Object.keys(linkPair)[0];
                        return (
                            <LinkRow
                                key={linkPair[key].concat(index.toString())}
                                linkPair={linkPair}
                                index={index}
                                keyString={key}
                            />
                        );
                    },
                )}
                <button
                    className="btn btn-active
                    bg-base-200 w-full p-2"
                    onClick={() => addLinkModal.current?.showModal()}
                >
                    <PlusIcon className="w-6 mx-auto" />
                </button>
            </ul>
            {/* Modals */}
            <dialog ref={deleteLinkModal} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                            ✕
                        </button>
                    </form>
                    <h3 className="font-bold text-lg">Delete Link</h3>
                    <p className="py-4">
                        Are you sure you would like to delete this link?
                    </p>
                    <form
                        method="dialog"
                        className="flex flex-row justify-between"
                    >
                        <button className="btn">Cancel</button>
                        <button
                            className="btn btn-error"
                            onClick={() =>
                                deleteLink(category, activeLinkToDelete)
                            }
                        >
                            Delete Link
                        </button>
                    </form>
                </div>
            </dialog>
            <dialog ref={addLinkModal} className="modal">
                <div className="modal-box">
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Add Link
                        </span>
                        <AddLinkForm
                            onSuccess={(title: string, url: string) => {
                                addLink(category, title, url),
                                    addLinkModal.current?.close();
                            }}
                        />
                    </div>
                </div>
            </dialog>
        </details>
    );
}

export default function LeftMenuManagement({ auth }: PageProps) {
    const { data, error, mutate, isLoading } = useSWR("/api/v1/categories");
    const [categoryList, setCategoryList] = useState(Array<Category>);
    const [categoryToDelete, setCategoryToDelete] = useState<number | null>(
        null,
    );
    const addCategoryModal = useRef<null | HTMLDialogElement>(null);
    const deleteCategoryModal = useRef<null | HTMLDialogElement>(null);
    const categoriesSavedSuccessToast = useRef<null | HTMLDivElement>(null);
    const categoriesSavedFailureToast = useRef<null | HTMLDivElement>(null);

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
                                    moveLinkUp={moveLinkUp}
                                    moveLinkDown={moveLinkDown}
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

    function deleteCategory(id: number) {
        const newCategories = categoryList.filter(
            (category) => category.id !== id,
        );
        setCategoryList(newCategories);
    }

    function deleteAndClose() {
        if (categoryToDelete != null) deleteCategory(categoryToDelete);
        deleteCategoryModal.current?.close();
    }

    function addLink(category: Category, newTitle: string, newURL: string) {
        let newLink: CategoryLink = {};
        newLink[newTitle] = newURL;
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                // add link to the category
                c.links.push(newLink);
                return c;
            } else {
                // The rest haven't changed
                return c;
            }
        });
        setCategoryList(newCategoryList);
    }

    function deleteLink(category: Category, activeLinkToDelete: CategoryLink) {
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                // delete link of the category
                c.links = c.links.filter((link) => link !== activeLinkToDelete);
                return c;
            } else {
                // The rest haven't changed
                return c;
            }
        });
        setCategoryList(newCategoryList);
    }

    function moveLinkUp(category: Category, linkIndex: number) {
        if (linkIndex == 0) return;
        const prevLinkIndex = linkIndex - 1;
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                const linksArray = c.links;
                const temp = linksArray[prevLinkIndex];
                linksArray[prevLinkIndex] = linksArray[linkIndex];
                linksArray[linkIndex] = temp;
                c.links = linksArray;
                return c;
            } else {
                // The rest haven't changed
                return c;
            }
        });
        setCategoryList(newCategoryList);
    }

    function moveLinkDown(category: Category, linkIndex: number) {
        if (linkIndex == category.links.length - 1) return;
        const postLinkIndex = linkIndex + 1;
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                const linksArray = c.links;
                const temp = linksArray[postLinkIndex];
                linksArray[postLinkIndex] = linksArray[linkIndex];
                linksArray[linkIndex] = temp;
                c.links = linksArray;
                return c;
            } else {
                // The rest haven't changed
                return c;
            }
        });
        setCategoryList(newCategoryList);
    }

    function updateLink(
        category: Category,
        linkIndex: number,
        newLinkPair: any,
    ) {
        const newCategoryList = categoryList.map((c, i) => {
            if (c == category) {
                category.links[linkIndex] = newLinkPair;
                return c;
            } else {
                // The rest haven't changed
                return c;
            }
        });
    }

    function handleSort() {
        if (draggedItem.current == null || dragOverItem == null) {
            return;
        }

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

        if (insertAtIndex == categoryList.length) {
            // add it to end of list
            newCategoryList.push(draggedItemContent);
        } else {
            //switch the position
            newCategoryList.splice(insertAtIndex, 0, draggedItemContent);
        }

        //update the actual array
        setCategoryList(newCategoryList);

        draggedItem.current = null;
        setDraggedOverItem(null);
    }

    async function updateFinalState(e: any) {
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
            if (response.status !== 200) {
                // show error
                categoriesSavedFailureToast.current?.classList.add(
                    "opacity-100",
                );
                setTimeout(() => {
                    categoriesSavedFailureToast.current?.classList.remove(
                        "opacity-100",
                    );
                }, 5000);
            } else {
                mutate();

                // show success
                categoriesSavedSuccessToast.current?.classList.add(
                    "opacity-100",
                );
                setTimeout(() => {
                    categoriesSavedSuccessToast.current?.classList.remove(
                        "opacity-100",
                    );
                }, 5000);
            }
        } catch {
            // show error
            categoriesSavedFailureToast.current?.classList.add("opacity-100");
            setTimeout(() => {
                categoriesSavedFailureToast.current?.classList.remove(
                    "opacity-100",
                );
            }, 5000);
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
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => updateFinalState(e)}
                    >
                        <DocumentCheckIcon className="h-4 text-base-100" />
                    </button>
                </div>
                <div>{MemoizedCategoryList}</div>
            </div>
            {/* Modals */}
            <dialog ref={deleteCategoryModal} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => deleteCategoryModal.current?.close()}
                        >
                            ✕
                        </button>
                    </form>
                    <h3 className="font-bold text-lg">Delete Category</h3>
                    <p className="py-4">
                        Are you sure you would like to delete this category?
                        <br /> Deleting this category will delete all links
                        associated with it.
                    </p>
                    <form
                        method="dialog"
                        className="flex flex-row justify-between"
                    >
                        <button className="btn">Cancel</button>
                        <button
                            className="btn btn-error"
                            type="button"
                            onClick={() => deleteAndClose()}
                        >
                            Delete Category
                        </button>
                    </form>
                </div>
            </dialog>
            <dialog ref={addCategoryModal} className="modal">
                <div className="modal-box">
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Add Category
                        </span>
                        <AddCategoryForm
                            onSuccess={(title: string) => addCategory(title)}
                        />
                    </div>
                </div>
            </dialog>
            {/* Toasts */}
            <div
                ref={categoriesSavedSuccessToast}
                className="toast transition-opacity duration-500 ease-out opacity-0"
            >
                <div className="alert alert-success">
                    <CheckCircleIcon className="h-6" />
                    <span>Categories saved!</span>
                </div>
            </div>
            <div
                ref={categoriesSavedFailureToast}
                className="toast transition-opacity duration-500 ease-out opacity-0"
            >
                <div className="alert alert-error text-neutral">
                    <ExclamationCircleIcon className="h-6" />
                    <span>Error saving categories</span>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
