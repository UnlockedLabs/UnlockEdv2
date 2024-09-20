import { PieChart, Pie, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ThemeContext } from './ThemeContext';
import { useContext } from 'react';
import { ProgramActivity } from '@/common';

export default function TopProgPieChart({ data }: { data: ProgramActivity[] }) {
    const { theme } = useContext(ThemeContext);
    const safeData =
        data && data.length > 0
            ? data
            : [{ program_name: '', hours_engaged: 0 }];

    var COLORS = ['#D7F4F1', '#B0DFDA', '#18ABA0', '#005952', '#002E2A'];
    if (theme == 'dark') {
        COLORS = ['#11554E', '#13746C', '#14958A', '#61BAB2', '#B0DFDA'];
    }

    console.log(data);

    return (
        <ResponsiveContainer width="100%" height={400}>
            <PieChart>
                <Pie
                    data={safeData}
                    dataKey="hours_engaged"
                    nameKey="program_name"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    innerRadius="50%"
                    fill="#8884d8"
                    label={false}
                >
                    {data.map((_, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                        />
                    ))}
                </Pie>
                <Legend layout="horizontal" />
            </PieChart>
        </ResponsiveContainer>
    );
}
