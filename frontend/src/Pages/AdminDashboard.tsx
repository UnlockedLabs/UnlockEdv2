import { useAuth } from "@/AuthContext";
import MilestonesBarChart from "@/Components/MilestonesBarChart";
import ActivityChart from "@/Components/MonthActivityChart";
import StatsCard from "@/Components/StatsCard";
import TopProgPieChart from "@/Components/TopProgActivityPieChart";
import { AdminDashboardJoin, ServerResponse } from "@/common";
import useSWR from "swr";
import convertSeconds from "../Components/ConvertSeconds";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, error, isLoading } = useSWR<ServerResponse<AdminDashboardJoin>>(
    `/api/users/${user.id}/admin-dashboard`
  );

  if (error || isLoading) return <div></div>;
  const avgActivity = convertSeconds(data.avg_daily_activity);
  const totalActivity = convertSeconds(data.total_weekly_activity);
  console.log(data);

  return (
    <div className="px-8 py-4">
      <h1 className="text-5xl">{data.facility_name}</h1>
      <div className="flex flex-row mt-12 gap-12">
        <div className="flex flex-col gap-6">
          <div className="card h-[240px]">
            <h2 className="card-h-padding">Overall Platform Engagement</h2>
            <ActivityChart data={data.monthly_activity} />
          </div>
          <div className="grid grid-cols-3 gap-6">
            <StatsCard
              title={"ACTIVE USERS"}
              number={data.weekly_active_users}
              label={"students"}
            />
            <StatsCard
              title={"AVG DAILY ACTIVITY"}
              number={avgActivity.number.toString()}
              label={avgActivity.label}
            />
            <StatsCard
              title={"TOTAL WEEK ACTIVITY"}
              number={totalActivity.number.toString()}
              label={totalActivity.label}
            />
          </div>
          <div className="card h-[368px]">
            <h2 className="card-h-padding">
              This Week's Milestone Completion Per Course
            </h2>
            <MilestonesBarChart data={data.program_milestones} />
          </div>
        </div>
        {/* Top course engagement */}
        <div className="card h-100 w-[35%] flex flex-col justify-between">
          <h2 className="card-h-padding">Top Course Engagement</h2>
          <TopProgPieChart data={data.top_program_activity} />
          <div className="px-4 py-10">
            {/* TO DO: caption needs to be added */}
            <table className="table-2">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Time Spent</th>
                </tr>
              </thead>
              <tbody className="!gap-6">
                {!error &&
                  !isLoading &&
                  data.top_program_activity.map(
                    (course: any, index: number) => {
                      var courseTime: string;
                      if (course.hours_engaged < 1)
                        courseTime =
                          Math.round(course.hours_engaged * 60) + " min";
                      else {
                        const hours = Math.floor(course.hours_engaged);
                        const leftoverMins =
                          Math.round(course.hours_engaged * 60) % 60;
                        if (leftoverMins == 0) courseTime = hours + " hrs";
                        else
                          courseTime = hours + " hr " + leftoverMins + " min";
                      }
                      var legendColor = "bg-teal-" + (index + 1).toString();
                      // TO DO: temporary fix... figure out why teal-5 doesnt render immediately
                      if (index == 4) legendColor = "bg-[#002E2A]";
                      return (
                        <tr key={index}>
                          <td className="flex flex-row gap-2">
                            <div
                              className={`h-3 w-3 ${legendColor} my-auto`}
                            ></div>
                            {course.program_name}
                          </td>
                          <td>{courseTime}</td>
                        </tr>
                      );
                    }
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
