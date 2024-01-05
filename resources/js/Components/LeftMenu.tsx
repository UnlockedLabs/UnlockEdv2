import Brand from "./Brand";
import {
    HomeIcon,
    ArchiveBoxIcon,
    BookOpenIcon,
} from "@heroicons/react/24/solid";

interface CategoryParameters {
    categoryName: string;
    linksArray: Array<LinksArrayParameters>;
}
// had to add undefined to this, but not sure if that is not allowed
interface LinksArrayParameters {
    [linkName: string]: string | undefined;
}

function Category({categoryName, linksArray}:CategoryParameters) {
    const linksList = linksArray.map((linkPair: { [x: string]: string | undefined; }) => {
        const key = Object.keys(linkPair)[0];
        return (
            <li>
                <a href={linkPair[key]}>{key}</a>
            </li>
        )
    })
    return(
        <li>
            <details>
                <summary>
                    <ArchiveBoxIcon className="w-4" />
                    {categoryName}
                </summary>
                <ul>
                    {linksList}
                </ul>
            </details>
        </li>
    )
}
 
export default function LeftMenu() {
    const categoryData = [{ name: "Category 1", links: [{ "Link 1 Name": "http://link1.com" }, { "Link 2 Name": "http://link2.com" }] }, { name: "Category 2", links: [{ "Link 1 Name": "http://link1.com" }, { "Link 2 Name": "http://link2.com" }] }];
    const categoryItems = categoryData.map((category) =>{
        return (<Category categoryName={category.name} linksArray={category.links}/>)
    });

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
