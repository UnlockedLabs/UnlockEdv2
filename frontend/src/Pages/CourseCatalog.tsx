import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import ToggleView, { ViewType } from "@/Components/ToggleView";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { useState } from "react";
import { recentCourses } from "./Dashboard";
import CatalogCourseCard from "@/Components/CatalogCourseCard";
import CatalogCourseCardList from "@/Components/CatalogCourseCardList";

// TO DO: make it paginated
// TO DO: mutate the data on save so it stays the same across both views

export default function CourseCatalog(){
    const auth = useAuth();
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);

    return(
        <AuthenticatedLayout title="Course Catalog">
            <PageNav user={auth.user} path={["Course Catalog"]} />
            <div className="px-8 py-4">
                <div className="flex flex-row justify-between">
                    <h1>Course Catalog</h1>
                    <ToggleView activeView={activeView} setActiveView={setActiveView}/>
                </div>
                <div className="flex flex-row items-center mt-4 justify-between">
                    {/* TO DO: REPLACE WITH MADE SEARCH BAR */}
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
                {/* render on gallery or list view */}
                {activeView == ViewType.Grid ? (
                <div className="grid grid-cols-4 gap-6 mt-8">
                    {recentCourses.map((course)=>{
                        return <CatalogCourseCard course={course} />
                    })}
                </div>
                ) : (
                <>
                    <div className="flex flex-row mt-8 px-6">
                        <label className="body-small w-1/2">Course Name</label>
                        <label className="body-small w-1/2">Description</label>
                    </div>
                    <div className="grid gap-4 mt-2">
                        {recentCourses.map((course)=>{
                            return <CatalogCourseCardList course={course} />
                        })}
                    </div>
                </>
                )}
            </div>
        </AuthenticatedLayout>
    )
}