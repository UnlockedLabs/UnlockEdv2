import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import CourseCard from "@/Components/CourseCard";
import CurrentlyEnrolledClass from "@/Components/CurrentlyEnrolledClass";
import NotificationsSideBar from "@/Components/NotificationsSideBar";
import { useAuth } from "@/AuthContext";
import { CourseStatus } from "./MyCourses";

//TO DO: make a type for courses when the new structure is finalized

// mock data of 3 courses that will be returned as recent
// added a field for total time since this will likely change in the future
export const recentCourses = [
  {
    course_id: 1,
    course_code: "CS101",
    course_name: "Introduction to Computer Science",
    course_description:
      "An introductory course covering fundamental concepts in computer science.",
    enrollment_state: "active",
    external_course_id: "12345",
    external_enrollment_id: "67890",
    external_link_url: "http://example.com/cs101",
    img_url:
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
    total_time: 86768,
    percent_completed: 59,
    status: CourseStatus.Pending,
    favorited: true,
  },
  {
    course_id: 2,
    course_code: "ENG201",
    course_name: "Advanced English Composition",
    course_description:
      "A course focusing on advanced writing techniques and literary analysis.",
    enrollment_state: "active",
    external_course_id: "54321",
    external_enrollment_id: "09876",
    external_link_url: "http://example.com/eng201",
    img_url:
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

    total_time: 8897,
    percent_completed: 12,
    status: CourseStatus.Completed,
    grade: "B+",
    favorited: true,
  },
  {
    course_id: 3,
    course_code: "MATH301",
    course_name: "Linear Algebra",
    course_description:
      "A course covering the theory and applications of linear algebra.",
    enrollment_state: "active",
    external_course_id: "98765",
    external_enrollment_id: "54321",
    external_link_url: "http://example.com/math301",
    img_url:
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
    total_time: 23731,
    percent_completed: 87,
    status: CourseStatus.Current,
  },
];

export default function Dashboard() {
  const numLessons = 5;

  const currDate = new Date();
  const pastWeek = new Date();
  pastWeek.setDate(currDate.getDate() - 7);

  const { user } = useAuth();

  // const {
  //     data: weekActivityData,
  //     error: weekActivityError,
  //     isLoading: weekActivityLoading,
  // } = useSWR(
  //     "/api/v1/user-activity-map/" +
  //         auth.user.id +
  //         "?start_date=" +
  //         pastWeek.toISOString().split("T")[0] +
  //         "&end_date=" +
  //         currDate.toISOString().split("T")[0],
  // );

  // const {
  //     data: enrollments,
  //     error: enrollmentsError,
  //     isLoading: enrollmentsLoading,
  // } = useSWR(`/api/v1/enrollments`);

  // const { data:programs, error:programserror, isLoading:programsloading } = useSWR(`api/programs`)

  return (
    <AuthenticatedLayout title="Dashboard">
      <PageNav user={user} path={["Dashboard"]} />
      <div className="flex">
        <div className="px-8 py-4">
          <h1 className="text-5xl">Hi, {user.name_first}!</h1>
          <h2 className="mt-2">
            You have completed{" "}
            <span className="text-teal-3 dark:text-teal-4">
              {numLessons} lessons{" "}
            </span>{" "}
            this week. Keep up the good work!
          </h2>

          <h2 className="mt-7"> Pick Up Where You Left Off</h2>
          <div className="mt-3 bg-base-teal p-6 card">
            <div className="grid grid-cols-3 gap-5">
              {recentCourses.map((course, index) => {
                return (
                  <CourseCard
                    course={course}
                    status={CourseStatus.Current}
                    recent={true}
                    favorited={course.favorited}
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
                  <tbody className="flex flex-col gap-4 mt-4">
                    {recentCourses.map((course: any, index: number) => {
                      return (
                        <tr
                          className="flex flex-row justify-between"
                          key={index}
                        >
                          <td className="body-small">{course.course_name}</td>
                          <td className="body-small">
                            {Math.floor(course.total_time / 60 / 60)} hrs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <h2 className="mt-12">Currently Enrolled Classes</h2>
          <div className="mt-3 bg-base-teal p-6 card">
            {/* {!enrollmentsError && !enrollmentsLoading && ( */}
            <div className="flex flex-col gap-3">
              {recentCourses.map((course: any) => {
                return (
                  <CurrentlyEnrolledClass course={course} key={Math.random()} />
                );
              })}
            </div>
            {/* )} */}
          </div>
        </div>
        <div className="w-0.5 bg-grey-1"></div>
        <NotificationsSideBar />
      </div>
    </AuthenticatedLayout>
  );
}
