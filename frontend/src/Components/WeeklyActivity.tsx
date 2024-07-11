import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ThemeContext } from "./ThemeContext";
import { useContext } from "react";
import { RecentActivity } from "@/common";

const WeekActivityChart = ({ data }: { data: any }) => {
  const { theme } = useContext(ThemeContext);
  var lineColor = theme == "light" ? "#18ABA0" : "#61BAB2";
  var gridColor = theme == "light" ? "#ECECEC" : "#737373";
  var backgroundColor = theme == "light" ? "#FFFFFF" : "#0F2926";
  console.log(data);

  const result: RecentActivity[] = new Array(7);
  let currentDate = new Date();

  for (let i = 6; i >= 0; i--) {
    let date = new Date(currentDate);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split("T")[0] + "T00:00:00Z";
    let entry = data.find(
      (activity: RecentActivity) => activity.date === dateString
    );
    if (entry) {
      entry = {
        date: entry.date.split("T")[0],
        delta: Math.round(entry.delta / 60),
      };
    } else {
      entry = { date: dateString.split("T")[0], delta: 0 };
    }
    result[6 - i] = entry;
  }

  const weekdays = [
    "Sun",
    "Mon",
    "Tues",
    "Wed",
    "Thurs",
    "Fri",
    "Sat",
    "Today",
  ];
  const XAxisTick = (props) => {
    const { x, y, payload } = props;
    console.log(payload.value);
    let day = new Date(payload.value).getDay() + 1;
    console.log(day);
    console.log(weekdays[day]);
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={10}
          y={0}
          dy={16}
          textAnchor="end"
          fill="#666"
          transform="rotate(-35)"
          style={{ fontSize: 12 }}
        >
          {weekdays[day]}
        </text>
      </g>
    );
  };
  return (
    <ResponsiveContainer>
      <LineChart
        data={result}
        margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
      >
        <CartesianGrid stroke={gridColor} />
        <XAxis dataKey={"date"} tick={<XAxisTick />} />
        <YAxis
          dataKey={"delta"}
          label={{
            value: `Minutes`,
            style: { textAnchor: "middle" },
            angle: -90,
            position: "left",
            offset: -10,
          }}
        />
        <Tooltip
          labelClassName="text-body"
          contentStyle={{ backgroundColor: backgroundColor }}
        />
        <Line
          type="monotone"
          dataKey={"delta"}
          stroke={lineColor}
          strokeWidth={3}
          dot={{ r: 3 }}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default WeekActivityChart;
