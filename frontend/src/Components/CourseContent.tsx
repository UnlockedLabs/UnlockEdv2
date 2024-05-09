import { Program, ServerResponse } from "@/common";
import CourseCard from "./CourseCard";
import useSWR from "swr";
import { CourseStatus } from "@/Pages/MyCourses";

export default function CourseContent() {
  const {
    data: enrollments,
    error,
    isLoading,
  } = useSWR<ServerResponse<Program>>(`/api/programs`);

  return (
    <div className="p-4 grid grid-cols-3 gap-5 w-[85%]">
      {!isLoading && !error ? (
        enrollments.data.map((course: any) => (
          <CourseCard course={course} key={course.id} status={CourseStatus.Current} favorited={false} />
        ))
      ) : (
        <div></div>
      )}
    </div>
  );
}
