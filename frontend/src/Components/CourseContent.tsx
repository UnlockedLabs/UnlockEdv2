import useSWR from "swr";
import { AuthProvider } from "../AuthContext";

export default function CourseContent() {
  const {
    data: enrollments,
    error,
    isLoading,
  } = useSWR(`/api/milestones`);

  function CourseCard({ course }: { course: any }) {
    // Function to truncate the description to the first 100 characters
    const truncateDescription = (description: string) => {
      if (description.length > 100) {
        return description.slice(0, 100) + "...";
      } else {
        return description;
      }
    };
    const coverImage = course.img_url;
    let url = course.external_link_url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    return (
      <AuthProvider>
      // temp solution for height, make sure they are all the same height without fixing it
        <div className="h-[400px]">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <div className="card card-compact bg-base-100 shadow-xl h-full">
              <figure className="h-[60%] p-2">
                <img
                  src={coverImage}
                  alt=""
                  className="object-contain"
                />
              </figure>
              <div className="card-body">
                <h2 className="text-slate-600">
                  {course.course_code}
                </h2>
                <h1 className="card-title">{course.course_name}</h1>
                <p>
                  {truncateDescription(
                    course.course_description
                      ? course.course_description
                      : "",
                  )}
                </p>
              </div>
            </div>
          </a>
        </div>
      </AuthProvider>
    );
  }

  return (
    <div className="p-4 grid grid-cols-3 gap-5 w-[85%]">
      {!isLoading && !error ? (
        enrollments.data.map((course: any) => (
          <CourseCard course={course} key={course.id} />
        ))
      ) : (
        <div></div>
      )}
    </div>
  );
}
