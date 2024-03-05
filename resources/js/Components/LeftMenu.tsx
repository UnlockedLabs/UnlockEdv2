import axios from "axios";
import Brand from "./Brand";
import {
    HomeIcon,
    ArchiveBoxIcon,
    BookOpenIcon,
} from "@heroicons/react/24/solid";
import useSWR from "swr";
import { Category, CategoryLink } from "@/common";
import { useMemo } from "react";

function CategoryItem({ name, links, rank }: Category) {
    const linksList = links.map((linkPair: { [x: string]: string }) => {
        const key = Object.keys(linkPair)[0];
        return (
            <li key={key.concat(rank.toString())}>
                <a
                    href={linkPair[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {key}
                </a>
            </li>
        );
    });
    return (
        <li>
            <details>
                <summary>
                    <ArchiveBoxIcon className="w-4" />
                    {name}
                </summary>
                <ul>{linksList}</ul>
            </details>
        </li>
    );
}

export default function LeftMenu() {
    const { data, error, isLoading } = useSWR("/api/v1/categories");

    const categoryItems = useMemo(() => {
        if (error) return <div>failed to load</div>;
        if (isLoading) return <div>loading...</div>;
        return data.data.map((category: Category) => {
            return (
                <CategoryItem
                    key={category.id}
                    id={category.id}
                    name={category.name}
                    links={category.links}
                    rank={category.rank}
                />
            );
        });
    }, [data]);

    return (
        <ul className="menu bg-base-100 w-72">
            <li>
                <a href="/" className="mb-4">
                    <Brand />
                </a>
            </li>
            <li>
                <a href="/dashboard">
                    <HomeIcon className="w-4" /> Dashboard
                </a>
            </li>
            {categoryItems}
        </ul>
    );
}
