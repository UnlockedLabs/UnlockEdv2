import { UserRole } from "@/common";
import Brand from "./Brand";
import {
  ArchiveBoxIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  HomeIcon,
  RectangleStackIcon,
  TrophyIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/AuthContext";

export default function Navbar() {
  const user = useAuth();
  return (
    <div className="w-60 min-w-[240px] h-screen flex flex-col justify-between bg-background">
      <ul className="menu">
        <a href="/" className="mt-24">
          <Brand />
        </a>
        {user.user.role == UserRole.Admin ? (
          <>
            {/* admin view */}
            <li className="mt-16">
              <a href="/dashboard">
                <HomeIcon className="w-4" /> Dashboard
              </a>
            </li>
            <li>
              <a href="/users">
                <UsersIcon className="h-4" />
                Users
              </a>
            </li>
            <li>
              <a href="/user-activity">
                <ChartBarIcon className="h-4" />
                Activity
              </a>
            </li>
            <li>
              <a href="/left-menu-management">
                <ArchiveBoxIcon className="h-4" />
                Left Menu
              </a>
            </li>
            <li>
              <a href="/provider-platform-management">
                <RectangleStackIcon className="h-4" />
                Platforms
              </a>
            </li>
          </>
        ) : (
          <>
            {/* student view */}
            <li className="mt-16">
              <a href="/dashboard">
                <HomeIcon className="w-4" /> Dashboard
              </a>
            </li>
            <li className="">
              <a href="/my-courses">
                <BookOpenIcon className="w-4" /> My Courses
              </a>
            </li>
            <li className="">
              <a href="/my-progress">
                <TrophyIcon className="w-4" /> My Progress
              </a>
            </li>
            <li className="">
              <a href="/dashboard">
                <BuildingStorefrontIcon className="w-4" /> Course Catalog
              </a>
            </li>
          </>
        )}
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
