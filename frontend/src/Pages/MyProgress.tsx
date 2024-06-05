import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import StatsCard from "@/Components/StatsCard";
import UserActivityMap from "@/Components/UserActivityMap";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { recentCourses } from "./Dashboard";
import { CourseStatus } from "./MyCourses";
import CompletePill from "@/Components/pill-labels/CompletePill";
import InProgressPill from "@/Components/pill-labels/InProgressPill";

export default function MyProgress() {
  const {user} = useAuth();
  return (
    <AuthenticatedLayout title="My Progress">
      <PageNav user={user} path={["My Progress"]} />
      <div className="px-8 py-4 overflow-hidden">
        <h1>My Progress</h1>
        <div className="mt-7 flex flex-row gap-12">
          <div className="flex flex-col gap-5 w-full">
            <StatsCard title="TOTAL TIME" number={"11,321"} label="hrs" />
            <StatsCard title="COMPLETED" number={"37"} label="courses" />
          </div>
          <div className="w-full">
            <UserActivityMap />
          </div>
        </div>
        <div className="flex flex-row gap-12 mt-12">
          <div className="card bg-base-teal h-[531px] w-[60%] p-4 overflow-y-auto">
            <div className="flex flex-row">
              <h2>All Courses</h2>
              {/* dropdown will go here */}
            </div>
            <table className="w-full mt-4">
              <thead>
                <tr className="flex flex-row justify-between border border-x-0 border-t-0 body text-grey-4 text-left">
                  <th className="w-1/2">Course Name</th>
                  <th className="w-1/5">Status</th>
                  <th className="w-1/5">Grade</th>
                  <th className="w-1/5">Hours Spent</th>
                </tr>
              </thead>
              <tbody className="flex flex-col gap-4 mt-4">
                {recentCourses.map((course: any, index: number) => {
                  return (
                    <tr
                      className="flex flex-row justify-between body-small items-center"
                      key={index}
                    >
                      <td className="w-1/2">
                        {course.program_name} • {course.provider_platform_name}
                      </td>
                      <td className="w-1/5 flex">
                        {course.status == CourseStatus.Completed ? (
                          <CompletePill />
                        ) : (
                          <InProgressPill />
                        )}
                      </td>
                      <td className="w-1/5">{course?.grade || "-"}</td>
                      <td className="w-1/5">
                        {Math.floor(course.total_activity_time / 60 / 60)} hrs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card bg-base-teal h-[531px] w-[40%] p-4 overflow-y-auto">
            <div className="flex flex-row">
              <h2>Certificates Earned</h2>
              {/* dropdown will go here */}
            </div>
            <table className="w-full mt-4">
              <thead>
                <tr className="flex flex-row justify-between border border-x-0 border-t-0">
                  <th className="body text-grey-4">Certificate</th>
                  <th className="body text-grey-4">Date Recieved</th>
                </tr>
              </thead>
              <tbody className="flex flex-col gap-4 mt-4"></tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
