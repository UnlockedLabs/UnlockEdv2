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
import { useEffect, useRef, useState } from "react";
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

function CategoryItem({ name, links, rank }: Category) {
    const [linksArray, setLinks] = useState(links);
    const [activeLinkToDelete, setActiveLinkToDelete] = useState({ "": "" });
    const [newTitle, setNewTitle] = useState("");
    const [newURL, setNewURL] = useState("");
    const deleteLinkModal = useRef<null | HTMLDialogElement>(null);
    const addLinkModal = useRef<null | HTMLDialogElement>(null);

    function openDeleteLinkModal(linkPair: any) {
        setActiveLinkToDelete(linkPair);
        deleteLinkModal.current?.showModal();
    }

    function deleteLink() {
        const newLinks = linksArray.filter(
            (link) => link !== activeLinkToDelete,
        );
        setLinks(newLinks);
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

    function addLink() {
        var newLink: CategoryLink = {};
        newLink[newTitle] = newURL;
        setLinks([...linksArray, newLink]);
        setNewTitle("");
        setNewURL("");
    }

    return (
        <details className="">
            <summary className="flex flex-cols-3 justify-between text-base-100 font-bold bg-neutral p-4 rounded-br-lg rounded-tr-lg">
                <div></div>
                {name}
                <ChevronDownIcon className="w-4" />
            </summary>
            <ul className="card shadow-md p-4 gap-y-2 rounded-bl-none">
                <div className="flex flex-cols-2 font-bold gap-2 pr-6">
                    <h3 className="w-1/3">Title</h3>
                    <h3 className="w-2/3">URL</h3>
                </div>
                {linksArray.map((linkPair: { [x: string]: string }, index) => {
                    const key = Object.keys(linkPair)[0];
                    return (
                        <LinkRow
                            key={linkPair[key].concat(index.toString())}
                            linkPair={linkPair}
                            index={index}
                            keyString={key}
                        />
                    );
                })}
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
                        <button className="btn btn-error" onClick={deleteLink}>
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
                    <form method="dialog" onSubmit={addLink}>
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

    useEffect(() => {
        if (data != undefined) {
            setCategoryList(data.data);
        }
    }, [data]);

    function CategoryItemsList({
        data,
        error,
        isLoading,
        deleteCategoryModal,
        setCategoryToDelete,
    }: {
        data: Category[];
        error: any;
        isLoading: boolean;
        deleteCategoryModal: any;
        setCategoryToDelete: any;
    }) {
        if (error) return <div>failed to load</div>;
        if (isLoading) return <div>loading...</div>;
        return data.map((category) => {
            return (
                <div
                    className="py-3 flex"
                    key={category.name.concat(category.rank.toString())}
                >
                    <div className="bg-neutral rounded-bl-lg rounded-tl-lg pl-3 h-15">
                        <TrashIcon
                            className="w-4 mt-5 self-start text-base-100"
                            onClick={() => {
                                deleteCategoryModal.current?.showModal(),
                                    setCategoryToDelete(category.rank);
                            }}
                        />
                    </div>
                    <div className="grow">
                        <CategoryItem
                            name={category.name}
                            links={category.links}
                            rank={category.rank}
                        />
                    </div>
                </div>
            );
        });
    }

    function addCategory() {
        const newCategory = {
            name: newCategoryTitle,
            links: [],
            rank: categoryList.length + 1,
            deleteCategory: deleteCategory,
        };
        setCategoryList([...categoryList, newCategory]);
        setNewCategoryTitle("");
    }

    function deleteCategory(rank: number) {
        const newCategories = categoryList.filter(
            (category) => category.rank !== rank,
        );
        setCategoryList(newCategories);
    }

    function deleteAndClose() {
        if (categoryToDelete != null) deleteCategory(categoryToDelete);
        deleteCategoryModal.current?.close();
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
                <CategoryItemsList
                    data={categoryList}
                    error={error}
                    isLoading={isLoading}
                    deleteCategoryModal={deleteCategoryModal}
                    setCategoryToDelete={setCategoryToDelete}
                />
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
