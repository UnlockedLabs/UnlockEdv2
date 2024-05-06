import { User, UserRole } from "@/common";
import Brand from "./Brand";
import { ArrowRightEndOnRectangleIcon, HomeIcon } from "@heroicons/react/24/solid";
import { handleLogout, useAuth } from "@/AuthContext";
// import { Link } from "@inertiajs/react";

export default function Navbar() {
    const user = useAuth();
    return (
        <div className="w-60 min-w-[240px] h-screen flex flex-col justify-between bg-background">
            <ul className="menu">
                <a href="/" className="mt-24">
                    <Brand />
                </a>
                {/* this will be student view */}
                <li className="mt-16">
                    <a href="/dashboard">
                        <HomeIcon className="w-4" /> Dashboard
                    </a>
                </li>
                <li className="">
                    <a href="/dashboard">
                        <HomeIcon className="w-4" /> My Courses
                    </a>
                </li>
                <li className="">
                    <a href="/dashboard">
                        <HomeIcon className="w-4" /> My Progress
                    </a>
                </li>
                <li className="">
                    <a href="/dashboard">
                        <HomeIcon className="w-4" /> Course Catalog
                    </a>
                </li>
                {user.user.role == UserRole.Admin ? <div></div> : <></>}
            </ul>
            {/* <div className="">
                <ul className="menu mb-5">
                    <li>
                        <button onClick={() => handleLogout()}>
                            <ArrowRightEndOnRectangleIcon className="h-4" />
                            Logout
                        </button>
                    </li>
                </ul>
            </div> */}
        </div>
    );
}
