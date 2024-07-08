import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ThemeContext } from "./ThemeContext";
import { useContext } from "react";

const MilestonesBarChart = ({ data }: { data: any }) => {
  const { theme } = useContext(ThemeContext);

  var barColor = theme == "light" ? "#18ABA0" : "#61BAB2";
  var backgroundColor = theme == "light" ? "#FFFFFF" : "#0F2926";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="alt_name" />
        <YAxis
          dataKey={"milestones"}
          label={{
            value: `Milestones`,
            style: { textAnchor: "middle" },
            angle: -90,
            position: "left",
            offset: 0,
          }}
        />
        <Tooltip
          labelClassName="text-body"
          contentStyle={{ backgroundColor: backgroundColor }}
          cursor={{ opacity: 0.3 }}
        />
        <Bar dataKey="milestones" fill={barColor} activeBar={{}} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MilestonesBarChart;
