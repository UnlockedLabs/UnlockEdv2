import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import CourseCard from "@/Components/EnrolledCourseCard";
import CurrentlyEnrolledClass from "@/Components/CurrentlyEnrolledClass";
import NotificationsSideBar from "@/Components/NotificationsSideBar";
import { useAuth } from "@/AuthContext";
import { CourseStatus } from "./MyCourses";
import { PillTagType } from "@/Components/CatalogCourseCard";
import useSWR from "swr";
import { ServerResponse } from "@/common";

//TO DO: make a type for courses when the new structure is finalized

// mock data of 3 courses that will be returned as recent
// added a field for total time since this will likely change in the future
export const recentCourses = [
  {
    course_id: 1,
    course_code: "CS101",
    program_name : "Introduction to Computer Science",
    course_description:
      "An introductory course covering fundamental concepts in computer science.",
    enrollment_state: "active",
    external_course_id: "12345",
    external_enrollment_id: "67890",
    external_url: "http://example.com/cs101",
    thumbnail_url:
      "https://upload.wikimedia.org/wikipedia/commons/e/e1/Computer_science_and_engineering.jpg",
    provider_platform_id: 1,
    provider_platform_name: "Kolibri",
    provider_platform_icon_url:
      "https://via.placeholder.com/640x480.png/00aa88?text=EU",
    provider_platform_url: "http://example.com/university",
    external_start_at: "2024-05-01T00:00:00.000000Z",
    external_end_at: "2024-08-31T23:59:59.000000Z",
    external_user_id: "54321",
    user_id: 1,
    user_name: "John Doe",
    created_at: "2024-04-24T18:53:58.000000Z",
    updated_at: "2024-04-24T18:53:58.000000Z",

    // below are the added fields of information needed
    total_activity_time: 86768,
    course_progress: 59,
    status: CourseStatus.Pending,
    favorited: true,
    tags: [PillTagType.Open],
  },
  {
    course_id: 2,
    course_code: "ENG201",
    program_name : "Advanced English Composition",
    course_description:
      "A course focusing on advanced writing techniques and literary analysis.",
    enrollment_state: "active",
    external_course_id: "54321",
    external_enrollment_id: "09876",
    external_url: "http://example.com/eng201",
    thumbnail_url:
      "https://news.northeastern.edu/wp-content/uploads/2016/10/writing_1400.jpg",
    provider_platform_id: 2,
    provider_platform_name: "Coursera",
    provider_platform_icon_url:
      "https://via.placeholder.com/640x480.png/00aa88?text=EC",
    provider_platform_url: "http://example.com/college",
    external_start_at: "2024-06-01T00:00:00.000000Z",
    external_end_at: "2024-09-30T23:59:59.000000Z",
    external_user_id: "54321",
    user_id: 1,
    user_name: "John Doe",
    created_at: "2024-04-24T18:53:58.000000Z",
    updated_at: "2024-04-24T18:53:58.000000Z",

    total_activity_time: 8897,
    course_progress: 12,
    status: CourseStatus.Completed,
    grade: "B+",
    favorited: true,
    tags: [PillTagType.Permission],
  },
  {
    course_id: 3,
    course_code: "MATH301",
    program_name : "Linear Algebra",
    course_description:
      "A course covering the theory and applications of linear algebra.",
    enrollment_state: "active",
    external_course_id: "98765",
    external_enrollment_id: "54321",
    external_url: "http://example.com/math301",
    thumbnail_url:
      "https://i0.wp.com/calmatters.org/wp-content/uploads/2021/08/math-curriculum.jpg?fit=2000%2C1500&ssl=1",
    provider_platform_id: 3,
    provider_platform_name: "WashU Canvas",
    provider_platform_icon_url:
      "https://via.placeholder.com/640x480.png/00aa88?text=EI",
    provider_platform_url: "http://example.com/institute",
    external_start_at: "2024-07-01T00:00:00.000000Z",
    external_end_at: "2024-10-31T23:59:59.000000Z",
    external_user_id: "54321",
    user_id: 1,
    user_name: "John Doe",
    created_at: "2024-04-24T18:53:58.000000Z",
    updated_at: "2024-04-24T18:53:58.000000Z",
    total_activity_time: 23731,
    course_progress: 87,
    status: CourseStatus.Current,
    tags: [PillTagType.SelfPaced, PillTagType.Open],
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const {data, error, isLoading} = useSWR<ServerResponse<any>>(`/api/users/${user.id}/student-dashboard`)
  const {data:admin} = useSWR<ServerResponse<any>>(`/api/users/${user.id}/admin-dashboard`)
  console.log(admin)

  const convertSeconds = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    if (hours) {
      return `${hours} hrs`;
    } else {
      return `${minutes} min`;
    }
  };

  return (
    <AuthenticatedLayout title="Dashboard">
      <PageNav user={user} path={["Dashboard"]} />
      <div className="flex">
        <div className="px-8 py-4">
          <h1 className="text-5xl">Hi, {user.name_first}!</h1>
          <h2 className="mt-7"> Pick Up Where You Left Off</h2>
          <div className="mt-3 bg-base-teal p-6 card">
            <div className="grid grid-cols-3 gap-5">
              {data && data?.recent_programs.map((course, index) => {
                return (
                  <CourseCard
                    course={course}
                    recent={true}
                    key={index}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex flex-row gap-12 mt-12">
            <div className="w-1/2 h-[254px] bg-base-teal card">
              <h2 className="mt-4 ml-4">My Activity</h2>
              {/* graph placeholder */}
            </div>
            <div className="w-1/2 h-[254px] bg-base-teal card">
              <h2 className="mt-4 ml-4">Learning Time</h2>
              <div className="px-4">
                {/* TO DO: caption needs to be added */}
                <table className="w-full">
                  <thead>
                    <tr className="flex flex-row justify-between border border-x-0 border-t-0 mt-2">
                      <th className="body text-grey-4">Course Name</th>
                      <th className="body text-grey-4">Hours Spent</th>
                    </tr>
                  </thead>
                  <tbody className="flex flex-col gap-4 mt-4 overflow-auto h-36 scrollbar">
                    {!error && !isLoading &&
                    (data?.enrollments?.map((course: any, index: number) => {
                      return (
                        <tr
                          className="flex flex-row justify-between mr-3"
                          key={index}
                        >
                          <td className="body-small">{course.name}</td>
                          <td className="body-small">
                            {convertSeconds(course.total_time)}
                          </td>
                        </tr>
                      );
                    }
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <h2 className="mt-12">Currently Enrolled Classes</h2>
          <div className="mt-3 bg-base-teal p-6 card">
            {!error && !isLoading && (
            <div className="flex flex-col gap-3">
              {data?.enrollments?.map((course: any) => {
                return (
                  <CurrentlyEnrolledClass course={course} key={Math.random()} />
                );
              })}
            </div>
            )}
          </div>
        </div>
        <div className="min-w-px bg-grey-1"></div>
        <NotificationsSideBar />
      </div>
    </AuthenticatedLayout>
  );
}
