import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import StatsCard from "@/Components/StatsCard";
import UserActivityMap from "@/Components/UserActivityMap";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { recentCourses } from "./Dashboard";
import { CourseStatus } from "./MyCourses";

export function CourseStatusPill({ status }: { status: CourseStatus }) {
  return (
    <p
      className={`px-2 py-1 rounded-2xl ${status == CourseStatus.Completed ? "bg-[#006059] text-white" : "bg-[#B0DFDA] text-[#006059]"}`}
    >
      {status == CourseStatus.Completed ? "completed" : "in progress"}
    </p>
  );
}

export default function MyProgress() {
  const auth = useAuth();

  return (
    <AuthenticatedLayout title="My Progress">
      <PageNav user={auth.user} path={["My Progress"]} />
      <div className="px-8 py-4">
        <h1>My Progress</h1>
        <div className="mt-7 flex flex-row gap-12">
          <div className="flex flex-col gap-5 w-full">
            <StatsCard title="TOTAL TIME" number={"11,321"} label="hrs" />
            <StatsCard title="COMPLETED" number={"37"} label="courses" />
          </div>
          <div className="w-full card">
            <UserActivityMap user={auth.user} />
          </div>
        </div>
        <div className="flex flex-row gap-12 mt-12">
          <div className="card h-[531px] w-[60%] p-4 overflow-y-auto">
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
                        {course.course_name} • {course.provider_platform_name}
                      </td>
                      <td className="w-1/5 flex">
                        <CourseStatusPill status={course.status} />
                      </td>
                      <td className="w-1/5">{course?.grade || "-"}</td>
                      <td className="w-1/5">
                        {Math.floor(course.total_time / 60 / 60)} hrs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card h-[531px] w-[40%] p-4 overflow-y-auto">
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
