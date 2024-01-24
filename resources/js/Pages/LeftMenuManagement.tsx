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

function CategoryItem({ categoryName, linksArray, rank }: Category) {
    const [links, setLinks] = useState(linksArray);
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
        const newLinks = links.filter((link) => link !== activeLinkToDelete);
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
        setLinks([...links, newLink]);
        setNewTitle("");
        setNewURL("");
    }

    return (
        <details className="">
            <summary className="flex flex-cols-3 justify-between text-base-100 font-bold bg-neutral p-4 rounded">
                <TrashIcon className="w-4" />
                {categoryName}
                <ChevronDownIcon className="w-4" />
            </summary>
            <ul className="card shadow-md p-4 gap-y-2">
                <div className="flex flex-cols-2 font-bold gap-2 pr-6">
                    <h3 className="w-1/3">Title</h3>
                    <h3 className="w-2/3">URL</h3>
                </div>
                {links.map((linkPair: { [x: string]: string }, index) => {
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

function getCategoryItems(
    data: { data: { name: string; rank: number; links: CategoryLink[] }[] },
    error: any,
    isLoading: boolean,
) {
    if (error) return <div>failed to load</div>;
    if (isLoading) return <div>loading...</div>;
    return data.data.map((category) => {
        return (
            <div className="py-3" key={category.rank}>
                <CategoryItem
                    categoryName={category.name}
                    linksArray={category.links}
                    rank={category.rank}
                />
            </div>
        );
    });
}

export default function LeftMenuManagement({ auth }: PageProps) {
    const { data, error, isLoading } = useSWR("/api/v1/categories");

    const categoryItems = getCategoryItems(data, error, isLoading);

    return (
        <AuthenticatedLayout user={auth.user} title="Categories">
            <PageNav
                user={auth.user}
                path={["Settings", "Left Menu Management"]}
            />
            <div className="p-4">
                <div className="flex justify-between">
                    <button className="btn btn-primary btn-sm">
                        <PlusCircleIcon className="h-4 text-base-100" />
                        <span className="text-base-100">Add Category</span>
                    </button>
                    <button className="btn btn-primary btn-sm">
                        <DocumentCheckIcon className="h-4 text-base-100" />
                    </button>
                </div>
                {categoryItems}
            </div>
        </AuthenticatedLayout>
    );
}
