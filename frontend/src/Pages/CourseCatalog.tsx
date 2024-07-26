import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import ToggleView, { ViewType } from "@/Components/ToggleView";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { useEffect, useState } from "react";
import CatalogCourseCard from "@/Components/CatalogCourseCard";
import SearchBar from "@/Components/inputs/SearchBar";
import { CourseCatalogue, Program, ServerResponse } from "@/common";
import useSWR from "swr";
import DropdownControl from "@/Components/inputs/DropdownControl";

// TO DO: make it paginated
// TO DO: mutate the data on save so it stays the same across both views

export default function CourseCatalog() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);
  const [searchTerm, setSearchTerm] = useState("");
  const [order, setOrder] = useState("asc");
  const { data, mutate } = useSWR<ServerResponse<Program>>(
    `/api/users/${user.id}/catalogue?search=${searchTerm}&order=${order}`,
  );

  useEffect(() => {
    console.log(data);
  }, [data]);

  function callMutate() {
    console.log("called");
    mutate();
  }

  function handleSearch(newSearch: string) {
    setSearchTerm(newSearch);
    // setPageQuery(1);
  }

  if (!data) return <div></div>;

  return (
    <AuthenticatedLayout title="Course Catalog">
      <PageNav user={user} path={["Course Catalog"]} />
      <div className="px-8 py-4">
        <div className="flex flex-row justify-between">
          <h1>Course Catalog</h1>
          <ToggleView activeView={activeView} setActiveView={setActiveView} />
        </div>
        <div className="flex flex-row items-center mt-4 justify-between">
          <SearchBar searchTerm={searchTerm} changeCallback={handleSearch} />
          <DropdownControl
            label="order"
            callback={setOrder}
            enumType={{
              Ascending: "asc",
              Descending: "desc",
            }}
          />
        </div>
        {/* render on gallery or list view */}
        <div
          className={`grid mt-8 ${activeView == ViewType.Grid ? "grid-cols-4 gap-6" : "gap-4"}`}
        >
          {data?.map((course: CourseCatalogue) => {
            return (
              <CatalogCourseCard
                course={course}
                callMutate={callMutate}
                view={activeView}
                key={course.program_id}
              />
            );
          })}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
