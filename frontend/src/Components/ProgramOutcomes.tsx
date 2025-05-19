import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer
} from 'recharts';
import { useContext } from 'react';
import { ThemeContext } from '@/Context/ThemeContext';

export default function ProgramOutcomes() {
    const { theme } = useContext(ThemeContext);

    const completionsColor = theme === 'light' ? '#18ABA0' : '#61BAB2';
    const dropoutsColor = theme === 'light' ? '#9CA3AF' : '#6B7280';
    const xAxisLabelColor = theme === 'light' ? '#333' : '#ccc';
    const yAxisLabelColor = theme === 'light' ? '#333' : '#ccc';

    const stackedData = [
        { month: 'Mar', dropouts: 20, completions: 40 },
        { month: 'Apr', dropouts: 9, completions: 30 },
        { month: 'May', dropouts: 8, completions: 35 },
        { month: 'Jun', dropouts: 10, completions: 20 },
        { month: 'Jul', dropouts: 28, completions: 40 },
        { month: 'Aug', dropouts: 14, completions: 15 }
    ];

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={stackedData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke={xAxisLabelColor} />
                <YAxis stroke={yAxisLabelColor} domain={[0, 100]} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#fff',
                        color: '#000'
                    }}
                />
                <Bar
                    dataKey="completions"
                    stackId="a"
                    fill={completionsColor}
                    name="Completions"
                />
                <Bar
                    dataKey="dropouts"
                    stackId="a"
                    fill={dropoutsColor}
                    name="Dropouts"
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
