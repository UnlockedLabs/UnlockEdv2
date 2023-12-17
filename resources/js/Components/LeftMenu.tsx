import Brand from "./Brand";
import { HomeIcon, UsersIcon, ArchiveBoxIcon } from "@heroicons/react/24/solid";

export default function LeftMenu() {
    return (
        <ul className="menu bg-base-200 w-64 rounded-box">
            <li>
                <a href="/" className="mb-4">
                    <Brand />
                </a>
            </li>

            <li>
                <a>
                    <HomeIcon className="w-4" /> Dashboard
                </a>
            </li>
            <li>
                <a>
                    <UsersIcon className="w-4" /> Users
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
