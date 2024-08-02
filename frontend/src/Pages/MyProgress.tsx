import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import StatsCard from "@/Components/StatsCard";
import UserActivityMap from "@/Components/UserActivityMap";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import DarkGreenPill from "@/Components/pill-labels/DarkGreenPill";
import TealPill from "@/Components/pill-labels/TealPill";
import useSWR from "swr";
import { ServerResponse } from "@/common";
import convertSeconds from "@/Components/ConvertSeconds";

export default function MyProgress() {
  const { user } = useAuth();
  const { data } = useSWR<ServerResponse<any>>(
    `/api/users/${user.id}/programs`,
  );
  const { data: certificates } = useSWR<ServerResponse<any>>(
    `/api/users/${user.id}/outcomes?type=certificate`,
  );

  console.log(data);

  return (
    <AuthenticatedLayout title="My Progress">
      <PageNav user={user} path={["My Progress"]} />
      <div className="px-8 py-4">
        <h1>My Progress</h1>
        {data && (
          <>
            <div className="mt-7 flex flex-row gap-12">
              <div className="flex flex-col justify-between w-full">
                <StatsCard
                  title="TOTAL TIME"
                  number={Math.floor(data.total_time / 3600).toString()}
                  label="hours"
                />
                <StatsCard
                  title="COMPLETED"
                  number={data.num_completed.toString()}
                  label="courses"
                />
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
                    {data.programs.map((course: any, index: number) => {
                      const courseTotalTime = convertSeconds(course.total_time);
                      return (
                        <tr
                          className="flex flex-row justify-between body-small items-center"
                          key={index}
                        >
                          <td className="w-1/2">{course.program_name}</td>
                          <td className="w-1/5 flex">
                            {course.course_progress == 100 ? (
                              <DarkGreenPill>completed</DarkGreenPill>
                            ) : (
                              <TealPill>in progress</TealPill>
                            )}
                          </td>
                          <td className="w-1/5">{course?.grade || "-"}</td>
                          <td className="w-1/5">
                            {courseTotalTime.number +
                              " " +
                              courseTotalTime.label}
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
                  <tbody className="flex flex-col gap-4 mt-4">
                    {certificates?.data.map((certificate: any) => {
                      return (
                        <tr
                          className="flex flex-row justify-between body-small items-center"
                          key={Math.random()}
                        >
                          <td className="w-1/2">{certificate.program_name}</td>
                          <td className="w-1/5 flex">
                            {new Date(
                              certificate.created_at.split("T")[0],
                            ).toLocaleDateString("en-US")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
