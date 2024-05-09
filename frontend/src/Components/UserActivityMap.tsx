import { useState } from "react";
import { DropdownControl } from "./inputs";
import useSWR from "swr";
import { User } from "@/common";

type ActivityMapData = {
  user_id: number;
  date: string;
  active_course_count: string;
  total_activity_time: string;
  total_activity_time_quartile: number;
};

/* interface for dynamically generated year options */
interface ValidYears {
  [year: string]: string;
}

/* subtract a year from a date */
const subtractYear = (date: Date) => {
  const newDate = new Date(date);
  newDate.setUTCFullYear(date.getUTCFullYear() - 1);
  newDate.setUTCDate(newDate.getUTCDate() + 1);
  return newDate;
};

/* predefining tailwind strings lets us assign them dynamically later */
const quartileColors: string[] = [
  "bg-inner-background",
  "bg-teal-1",
  "bg-teal-2",
  "bg-teal-3",
  "bg-teal-4",
];

/* node sizes for the activity map */
const nodeSizes: string =
  "w-1.5 h-1.5 rounded-sm text-xs md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-4 xl:h-4 xl:text-sm xl:rounded-md";

/* gaps between cells in activity map */
const gapSizes: string = "p-0 ml-px mt-px md:m-0 md:p-px";

/* main component for the user activity map */
export default function UserActivityMap({ user }: { user: User }) {
  const userCreatedAt = user.created_at
    ? new Date(user.created_at)
    : new Date(2024, 0, 1);

  const [yearEnd, setYearEnd] = useState(new Date());
  const [dropdownValDesc, setDropdownValDesc] = useState("the past year");

  const startDate = new Date(subtractYear(yearEnd));
  const { data, error, isLoading } = useSWR(
    "/api/user-activity-map/" +
      user.id +
      "?start_date=" +
      startDate.toISOString().split("T")[0] +
      "&end_date=" +
      yearEnd.toISOString().split("T")[0],
  );

  const generateYearOptions = () => {
    const years: ValidYears = { "Past year": "Past year" };
    const currentYear = new Date().getUTCFullYear();
    let i = currentYear - userCreatedAt.getUTCFullYear();
    for (i; i >= 0; i--) {
      /* added " " to change listed order without impacting appearance */
      const str = " " + String(userCreatedAt.getUTCFullYear() + i);
      years[str] = str;
    }
    return years;
  };

  const dropdownChange = (val: string) => {
    let date;
    if (val == "Past year") {
      date = new Date();
      setYearEnd(date);
      val = "the past year";
    } else {
      date = new Date(Number(val), 0, 1);
      setYearEnd(new Date(Number(val), 11, 31));
    }
    setDropdownValDesc(val);
  };

  /* generate nodes for the legend */
  const legendNodes: JSX.Element[] = [];
  for (let i = 0; i < 5; i++) {
    legendNodes.push(<Node quartile={i} key={i} />);
  }

  const yearOptions = generateYearOptions();

  return (
    <div className="w-[25.375rem] md:w-[35.25rem] lg:w-[49.875rem] xl:w-[65.063rem]">
      <div className="inline-block border shadow-xl rounded-xl p-4 card">
        <div className="flex justify-between">
          <form className="">
            <DropdownControl
              label=""
              callback={dropdownChange}
              enumType={yearOptions}
            />
          </form>
          <div className={"block font-bold text-center text"}>
            {/* Could put something here, like "Keep up the good work!" */}
          </div>
          <div className={"text-xs md:text-sm my-auto gap-x-1 flex"}>
            <div>Less</div>
            {legendNodes.map((node) => node)}
            <div>More</div>
          </div>
        </div>
        <div className="w-[372px] h-[99px] md:w-[530px] md:h-[124px] lg:w-[764px] lg:h-[152px] xl:w-[1017px] xl:h-[184px]">
          {error ? (
            <div className="flex h-full justify-center content-center">
              <div className="font-bold my-auto">
                Error loading activity. Please try again later.
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex h-full justify-center content-center">
              <span className="my-auto loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            data && (
              <div className="mt-8">
                <ActivityMapTable
                  data={data.data}
                  end={yearEnd}
                  error={error}
                  isLoading={isLoading}
                  range={dropdownValDesc}
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* component for the cells of our activity map */
function Node({
  quartile,
  date,
  activity_time,
  active_course_count,
}: {
  quartile: number;
  date?: Date;
  activity_time?: string;
  active_course_count?: string;
}) {
  let tooltipString = "";
  if (!date) {
    /* if node is from legend */
    return (
      <div
        className={`m-auto border border-neutral/20 ${nodeSizes} ${quartileColors[quartile]}`}
      />
    );
  }
  if (!activity_time) {
    tooltipString = "No activity on " + date.toISOString().split("T")[0];
  } else {
    tooltipString = `${activity_time} total activity in ${active_course_count} courses on ${
      date?.toISOString().split("T")[0]
    }`;
  }
  return (
    <div
      className={`m-auto border border-neutral/20 p-0 ${nodeSizes} ${quartileColors[quartile]}`}
    >
      <div className="tooltip h-full w-full" data-tip={tooltipString} />
    </div>
  );
}

/* component that builds the activity map table */
function ActivityMapTable({
  data,
  end,
  error,
  isLoading,
  range,
}: {
  data: ActivityMapData[];
  end: Date;
  error: any;
  isLoading: boolean;
  range: string;
}) {
  /* array that holds cells for the table */
  const tableData: JSX.Element[] = [];
  const tableMonths: string[] = [];
  let i;
  const len = data.length;
  //  const now = new Date();
  let aggregateActivityTime = 0;
  let oldMonth, newMonth;

  const convertSeconds = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getAggregateActivityTime = (time: number) => {
    const parsedTime = convertSeconds(time);
    if (error) {
      return "Error fetching activity data";
    }
    if (isLoading) {
      return "Loading...";
    } else if (time == 0) {
      return "No activity ";
    } else if (time == 1) {
      return "You have completed one hour of activity";
    } else {
      return "You have completed " + String(parsedTime) + " hours of activity";
    }
  };

  const insertMonthHeader = (date: Date) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    tableMonths.push(months[date.getUTCMonth()]);
  };

  const dateCount = subtractYear(end);
  data.sort((a, b) => {
    if (a.date < b.date) {
      return -1;
    } else if (a.date > b.date) {
      return 1;
    } else {
      return 0;
    }
  });

  /* add spacers for days of week before activity range */
  for (i = 0; i < dateCount.getUTCDay(); i++) {
    tableData.push(
      <td className={"block " + gapSizes} key={i}>
        <div className={`${nodeSizes}`}></div>
      </td>,
    );
  }

  i = 0;
  /* fill first months array element if range starts midweek */
  if (dateCount.getUTCDay() != 0) {
    if (dateCount.getUTCDate() < 8) {
      insertMonthHeader(dateCount);
    } else {
      tableMonths.push("");
    }
  }

  /* fill cells with Nodes for days in range */
  while (dateCount <= end) {
    /* at start of new week, if new, push month, else push empty string */
    if (dateCount.getUTCDay() == 0) {
      newMonth = dateCount.getUTCMonth();
      if (
        newMonth != oldMonth &&
        dateCount.getUTCDate() < 8 &&
        tableMonths[tableMonths.length - 1] == ""
      ) {
        insertMonthHeader(dateCount);
      } else {
        tableMonths.push("");
      }
      oldMonth = newMonth;
    }
    /* in range and activity on date */
    if (i < len && dateCount.toISOString().split("T")[0] == data[i].date) {
      tableData.push(
        <td className="block" key={dateCount.getTime()}>
          <Node
            date={new Date(dateCount)}
            activity_time={convertSeconds(Number(data[i].total_activity_time))}
            active_course_count={data[i].active_course_count}
            quartile={data[i].total_activity_time_quartile}
          />
        </td>,
      );
      aggregateActivityTime += Number(data[i].total_activity_time);
      i += 1;
    } else {
      tableData.push(
        <td className={"block " + gapSizes} key={dateCount.getTime()}>
          <Node date={new Date(dateCount)} quartile={0} />
        </td>,
      );
    }
    dateCount.setUTCDate(dateCount.getUTCDate() + 1);
  }

  /* add empty cells for days of week after activity range */
  for (i = dateCount.getUTCDay(); i < 7; i++) {
    tableData.push(
      <td className={"block " + gapSizes} key={i + 7}>
        <div className={`${nodeSizes}`}></div>
      </td>,
    );
  }
  return (
    <>
      <table className="table-auto ml-5 lg:ml-6">
        <tbody>
          <tr>
            {tableMonths.map((node, index) => {
              return (
                <td className={nodeSizes + " m-auto"} key={index}>
                  {node}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <table className="table-auto">
        <tbody className="block whitespace-nowrap">
          <tr className="text-center leading-3 mr-2 hidden lg:inline-block">
            <td className="block">
              <div className={nodeSizes}></div>
            </td>
            <td className="block -mt-1">
              <div className={nodeSizes}>M</div>
            </td>
            <td className="block">
              <div className={nodeSizes}></div>
            </td>
            <td className="block">
              <div className={nodeSizes}>W</div>
            </td>
            <td className="block">
              <div className={nodeSizes}></div>
            </td>
            <td className="block">
              <div className={nodeSizes}>F</div>
            </td>
            <td className="block">
              <div className={nodeSizes}></div>
            </td>
          </tr>
          {tableData.map((_, index) => {
            if (index % 7 == 0) {
              return (
                <tr className="inline-block" key={index}>
                  {tableData.slice(index, index + 7).map((node) => {
                    return node;
                  })}
                </tr>
              );
            }
          })}
        </tbody>
      </table>
      <div className="block text-xs md:text-sm font-bold text-center mt-4">
        {isLoading || error
          ? null
          : getAggregateActivityTime(Math.floor(aggregateActivityTime / 3600)) +
            " in " +
            range +
            "."}
      </div>
    </>
  );
}
