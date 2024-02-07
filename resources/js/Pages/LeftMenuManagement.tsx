import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Category, CategoryLink } from "@/common";
import { PageProps } from "@/types";
import { PlusCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import {
    ChevronDownIcon,
    TrashIcon,
    PlusIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

function LinkItem({
    linkName,
    linkURL,
}: {
    linkName: string;
    linkURL: string;
}) {
    const [name, setName] = useState(linkName);
    const [url, setURL] = useState(linkURL);
    return (
        <li className="flex flex-cols-2 gap-2 w-full">
            <input
                type="text"
                defaultValue={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered w-1/3"
            />
            <input
                type="text"
                defaultValue={url}
                onChange={(e) => setURL(e.target.value)}
                className="input input-bordered w-2/3"
            />
        </li>
    );
}

function CategoryItem({
    category,
    deleteLink,
    addLink,
}: {
    category: Category;
    deleteLink: any;
    addLink: any;
}) {
    const [activeLinkToDelete, setActiveLinkToDelete] = useState({ "": "" });
    const [newTitle, setNewTitle] = useState("");
    const [newURL, setNewURL] = useState("");
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
        return (
            <div className="flex flex-row justify-between gap-2">
                <LinkItem linkName={keyString} linkURL={linkPair[keyString]} />
                <TrashIcon
                    className="w-4"
                    onClick={() => openDeleteLinkModal(linkPair)}
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
                <ChevronDownIcon className="w-4" />
            </summary>
            <ul className="card shadow-md p-4 gap-y-2 rounded-bl-none">
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
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                            ✕
                        </button>
                    </form>
                    <form
                        method="dialog"
                        onSubmit={() => {
                            addLink(category, newTitle, newURL);
                            setNewTitle("");
                            setNewURL("");
                        }}
                    >
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-semibold pb-6 text-neutral">
                                Add Link
                            </span>
                            <label className="form-control w-full max-w-xs">
                                <div className="label">
                                    <span className="label-text">Title</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Type here"
                                    className="input input-bordered w-full max-w-xs"
                                    value={newTitle}
                                    onChange={(e) =>
                                        setNewTitle(e.target.value)
                                    }
                                    required
                                />
                            </label>
                            <label className="form-control w-full max-w-xs">
                                <div className="label">
                                    <span className="label-text">URL</span>
                                </div>
                                <input
                                    type="url"
                                    placeholder="Type here"
                                    className="input input-bordered w-full max-w-xs"
                                    value={newURL}
                                    onChange={(e) => setNewURL(e.target.value)}
                                    required
                                />
                            </label>
                            <label className="p-6">
                                <div></div>
                            </label>
                            <label className="form-control">
                                <button
                                    className="btn btn-primary"
                                    type="submit"
                                >
                                    Add
                                </button>
                            </label>
                        </div>
                    </form>
                </div>
            </dialog>
        </details>
    );
}

export default function LeftMenuManagement({ auth }: PageProps) {
    const { data, error, isLoading } = useSWR("/api/v1/categories");
    const [categoryList, setCategoryList] = useState(Array<Category>);
    const [newCategoryTitle, setNewCategoryTitle] = useState("");
    const [categoryToDelete, setCategoryToDelete] = useState<number | null>(
        null,
    );
    const addCategoryModal = useRef<null | HTMLDialogElement>(null);
    const deleteCategoryModal = useRef<null | HTMLDialogElement>(null);

    const draggedItem = useRef<null | number>(null);
    //const dragOverItem = useRef<null | number>(null);
    const [dragOverItem, setDraggedOverItem] = useState<null | number>(null);

    useEffect(() => {
        if (data != undefined) {
            setCategoryList(data.data);
        }
    }, [data]);

    // useEffect(() => {
    //     console.log(categoryList);
    // }, [categoryList]);

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
                                    className="w-4 mt-5 self-start text-base-100"
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

    function addCategory() {
        const newCategory = {
            id: Math.random(),
            name: newCategoryTitle,
            links: [],
            rank: categoryList.length + 1,
        };
        setCategoryList([...categoryList, newCategory]);
        setNewCategoryTitle("");
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
                    <button className="btn btn-primary btn-sm">
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
                        <button
                            className="btn"
                            onClick={() => deleteCategoryModal.current?.close()}
                        >
                            Cancel
                        </button>
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
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                            ✕
                        </button>
                    </form>
                    <form method="dialog" onSubmit={addCategory}>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-semibold pb-6 text-neutral">
                                Add Category
                            </span>
                            <label className="form-control w-full max-w-xs">
                                <div className="label">
                                    <span className="label-text">Title</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Type here"
                                    className="input input-bordered w-full max-w-xs"
                                    value={newCategoryTitle}
                                    onChange={(e) =>
                                        setNewCategoryTitle(e.target.value)
                                    }
                                    required
                                />
                            </label>
                            <label className="p-6">
                                <div></div>
                            </label>
                            <label className="form-control">
                                <button
                                    className="btn btn-primary"
                                    type="submit"
                                >
                                    Add
                                </button>
                            </label>
                        </div>
                    </form>
                </div>
            </dialog>
        </AuthenticatedLayout>
    );
}
