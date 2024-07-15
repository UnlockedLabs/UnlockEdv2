import CourseCard from "@/Components/EnrolledCourseCard";
import CurrentlyEnrolledClass from "@/Components/CurrentlyEnrolledClass";
import { useAuth } from "@/AuthContext";
import useSWR from "swr";
import { ServerResponse } from "@/common";
import convertSeconds from "@/Components/ConvertSeconds";
import ResourcesSideBar from "@/Components/ResourcesSideBar";
import WeekActivityChart from "@/Components/WeeklyActivity";
import Error from "./Error";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, isLoading } = useSWR<ServerResponse<any>>(
    `/api/users/${user.id}/student-dashboard`,
  );

  if (isLoading) return <div></div>;
  if (error) return <Error />;

  return (
    <div className="flex">
      <div className="px-8 py-4">
        <h1 className="text-5xl">Hi, {user.name_first}!</h1>
        <h2 className="mt-7"> Pick Up Where You Left Off</h2>
        <div className="mt-3 bg-base-teal p-6 card">
          <div className="grid grid-cols-3 gap-5">
            {data &&
              data?.recent_programs.map((course, index) => {
                return <CourseCard course={course} recent={true} key={index} />;
              })}
          </div>
        </div>
        <div className="flex flex-row gap-12 mt-12">
          <div className="w-1/2 h-[254px] bg-base-teal card">
            <h2 className="mt-4 ml-4">My Activity</h2>
            <WeekActivityChart data={data?.week_activity} />
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
                  {!error &&
                    !isLoading &&
                    data?.enrollments?.map((course: any, index: number) => {
                      const totalTime = convertSeconds(
                        course.total_activity_time,
                      );
                      return (
                        <tr
                          className="flex flex-row justify-between mr-3"
                          key={index}
                        >
                          <td className="body-small">{course.name}</td>
                          <td className="body-small">
                            {totalTime.number + " " + totalTime.label}
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
      <ResourcesSideBar />
    </div>
  );
}
