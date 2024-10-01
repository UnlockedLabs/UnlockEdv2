import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ThemeContext } from './ThemeContext';
import { useContext } from 'react';
import { CourseActivity } from '@/common';

export default function TopProgPieChart({ data }: { data: CourseActivity[] }) {
    const { theme } = useContext(ThemeContext);
    const safeData =
        data && data.length > 0
            ? data
            : [{ course_name: '', hours_engaged: 0 }];

    let COLORS = ['#D7F4F1', '#B0DFDA', '#18ABA0', '#005952', '#002E2A'];
    if (theme == 'dark') {
        COLORS = ['#11554E', '#13746C', '#14958A', '#61BAB2', '#B0DFDA'];
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <PieChart>
                <Pie
                    data={safeData}
                    dataKey="hours_engaged"
                    nameKey="course_name"
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
