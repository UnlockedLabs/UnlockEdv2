import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { recentCourses } from "./Dashboard";
import CourseCard from "@/Components/CourseCard";
import CourseCardList from "@/Components/CourseCardList";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/solid";
import { useState } from "react";

export enum ViewType {
  Grid = "Grid",
  List = "List",
}

// TO DO: make sure this lives in the right place
export enum CourseStatus {
  Current = "Current",
  Completed = "Completed",
  Pending = "Pending",
}

enum TabType {
  Current = "Current",
  Completed = "Completed",
  Favorited = "Favorited",
  Pending = "Pending",
}

// TO DO: go back and fix all "key" values that are mapped and make them intentional

export default function MyCourses() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(TabType.Current);
  const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);

  return (
    <AuthenticatedLayout title="My Courses">
      <PageNav user={auth.user} path={["My Courses"]} />
      <div className="px-8 py-4">
        <h1>My Courses</h1>
        <div className="flex flex-row gap-16 w-100 border-b-2 border-grey-2 py-3">
          {Object.entries(TabType).map(([key, value]) => (
            <button
              className={
                activeTab == TabType[key] ? "text-teal-4 font-bold" : ""
              }
              onClick={() => setActiveTab(TabType[key])}
              key={Math.random()}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex flex-row items-center mt-4 justify-between">
          {/* TO DO: REPLACE WITH MADE SEARCH BAR */}
          <div className="flex flex-row">
            <input
              type="text"
              placeholder="Search..."
              className="input input-bordered w-full max-w-xs input-sm"
              // value={searchTerm}
              // onChange={(e) => {
              // setSearchTerm(e.target.value);
              // setPageQuery(1);
              // }}
            />
          </div>
          <div className="flex flex-row items-center gap-2 body-small">
            <label>View</label>
            <div className="bg-teal-1 join p-1">
              {/* TO DO: come back and render on active or not */}
              <button
                className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.Grid && "bg-background"}`}
                onClick={() => setActiveView(ViewType.Grid)}
              >
                <Squares2X2Icon className="h-4"></Squares2X2Icon> Grid
              </button>
              <button
                className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.List && "bg-background"}`}
                onClick={() => setActiveView(ViewType.List)}
              >
                <ListBulletIcon className="h-4"></ListBulletIcon> List
              </button>
            </div>
          </div>
        </div>
        {/* render on gallery or list view */}
        {activeView == ViewType.Grid ? (
          <div className="grid grid-cols-4 gap-6 mt-8">
            {recentCourses.map((course: any, index: number) => {
              return (
                <CourseCard
                  course={course}
                  status={course.status}
                  favorited={course?.favorited}
                  key={index}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 mt-8">
            {recentCourses.map((course: any, index: number) => {
              return (
                <CourseCardList
                  course={course}
                  status={course.status}
                  favorited={course?.favorited}
                  key={index}
                />
              );
            })}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
