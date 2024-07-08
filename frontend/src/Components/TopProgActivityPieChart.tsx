import { PieChart, Pie, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ThemeContext } from './ThemeContext';
import { useContext } from 'react';

export default function TopProgPieChart ({data}:{data:any}){
  const { theme } = useContext(ThemeContext);

    var COLORS = ['#D7F4F1',"#B0DFDA", "#18ABA0", "#005952", "#002E2A"]
    if (theme == "dark" ) {
        COLORS = ['#11554E',"#13746C", "#14958A", "#61BAB2", "#B0DFDA"]
    }

    return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={data}
          dataKey="hours_engaged"
          nameKey="alt_name"
          cx="50%"
          cy="50%"
          outerRadius="80%"
          innerRadius="50%"
          fill="#8884d8"
          label={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
      </PieChart>
    </ResponsiveContainer>
    )
}