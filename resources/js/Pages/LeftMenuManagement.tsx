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
import useSWR from "swr";

function CategoryItem({ categoryName, linksArray, rank }: Category) {
    const linksList = linksArray.map((linkPair: { [x: string]: string }) => {
        const key = Object.keys(linkPair)[0];
        return (
            <li
                key={key.concat(rank.toString())}
                className="flex flex-cols-2 gap-2"
            >
                <input
                    type="text"
                    value={key}
                    className="input input-bordered w-1/3"
                />
                <input
                    type="text"
                    value={linkPair[key]}
                    className="input input-bordered w-2/3"
                />
            </li>
            // <li key={key.concat(rank.toString())}>
            //     <a href={linkPair[key]}>{key}</a>
            // </li>
        );
    });
    return (
        <details className="">
            <summary className="flex flex-cols-3 justify-between text-base-100 font-bold bg-neutral p-4 rounded">
                <TrashIcon className="w-4" />
                {categoryName}
                <ChevronDownIcon className="w-4" />
            </summary>
            <ul className="card shadow-md p-4 gap-y-2">
                <div className="flex flex-cols-2 font-bold gap-2">
                    <h3 className="w-1/3">Title</h3>
                    <h3 className="w-2/3">URL</h3>
                </div>
                {linksList}
                <button
                    className="btn btn-active
                    bg-base-200 w-full p-2"
                >
                    <PlusIcon className="w-6 mx-auto" />
                </button>
            </ul>
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
            <div className="py-3">
                <CategoryItem
                    key={category.rank}
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
