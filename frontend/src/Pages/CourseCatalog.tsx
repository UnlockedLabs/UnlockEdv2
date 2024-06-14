import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import ToggleView, { ViewType } from "@/Components/ToggleView";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { useEffect, useState } from "react";
import CatalogCourseCard from "@/Components/CatalogCourseCard";
import { Program, ServerResponse } from "@/common";
import useSWR from "swr";

// TO DO: make it paginated
// TO DO: mutate the data on save so it stays the same across both views

export default function CourseCatalog() {
  const {user} = useAuth();
  const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);

  const {data, mutate, error, isLoading} = useSWR<ServerResponse<Program>>(`/api/users/${user.id}/catalogue`)

  useEffect(() => {
    console.log(data);
  }, [data]);

  function callMutate(){
    console.log('called')
    mutate();
  }

  if (!data) return <div></div>

  return (
    <AuthenticatedLayout title="Course Catalog">
      <PageNav user={user} path={["Course Catalog"]} />
      <div className="px-8 py-4">
        <div className="flex flex-row justify-between">
          <h1>Course Catalog</h1>
          <ToggleView activeView={activeView} setActiveView={setActiveView} />
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
          <div className={`grid mt-8 ${ activeView == ViewType.Grid ? "grid-cols-4 gap-6": "gap-4"}`}>
            {data?.map((course) => {
              return <CatalogCourseCard course={course} callMutate={callMutate} view={activeView} key={Math.random()}/>;
            })}
          </div>
      </div>
    </AuthenticatedLayout>
  );
}
