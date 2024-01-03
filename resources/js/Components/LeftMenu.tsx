import Brand from "./Brand";
import {
    HomeIcon,
    ArchiveBoxIcon,
    BookOpenIcon,
} from "@heroicons/react/24/solid";

export default function LeftMenu() {
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
            <li>
                <details>
                    <summary>
                        <ArchiveBoxIcon className="w-4" />
                        Category 1
                    </summary>
                    <ul>
                        <li>
                            <a>Link 1</a>
                        </li>
                        <li>
                            <a>Link 2</a>
                        </li>
                    </ul>
                </details>
            </li>
            <li>
                <details>
                    <summary>
                        <ArchiveBoxIcon className="w-4" />
                        Category 2
                    </summary>
                    <ul>
                        <li>
                            <a>Link 1</a>
                        </li>
                        <li>
                            <a>Link 2</a>
                        </li>
                    </ul>
                </details>
            </li>
        </ul>
    );
}
