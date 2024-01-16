import axios from "axios";
import Brand from "./Brand";
import {
    HomeIcon,
    ArchiveBoxIcon,
    BookOpenIcon,
} from "@heroicons/react/24/solid";
import useSWR from "swr";

interface CategoryParameters {
    categoryName: string;
    linksArray: Array<LinksArrayParameters>;
    rank: number;
}
interface LinksArrayParameters {
    [linkName: string]: string;
}

function Category({ categoryName, linksArray, rank }: CategoryParameters) {
    const linksList = linksArray.map((linkPair: { [x: string]: string }) => {
        const key = Object.keys(linkPair)[0];
        return (
            <li key={key.concat(rank.toString())}>
                <a href={linkPair[key]}>{key}</a>
            </li>
        );
    });
    return (
        <li>
            <details>
                <summary>
                    <ArchiveBoxIcon className="w-4" />
                    {categoryName}
                </summary>
                <ul>{linksList}</ul>
            </details>
        </li>
    );
}

function getCategoryItems() {
    const { data, error, isLoading } = useSWR("/api/v1/categories", (url) =>
        axios.get(url).then((res) => res.data),
    );
    if (error) return <div>failed to load</div>;
    if (isLoading) return <div>loading...</div>;
    return data.data.map(
        (category: {
            name: string;
            rank: number;
            links: LinksArrayParameters[];
        }) => {
            return (
                <Category
                    key={category.rank}
                    categoryName={category.name}
                    linksArray={category.links}
                    rank={category.rank}
                />
            );
        },
    );
}

export default function LeftMenu() {
    const categoryItems = getCategoryItems();

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
            <li>
                <a href="/courses">
                    <BookOpenIcon className="w-4" /> Courses
                </a>
            </li>
            {categoryItems}
        </ul>
    );
}
