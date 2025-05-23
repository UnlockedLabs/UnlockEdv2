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
import { ProgramClassOutcomes } from '@/common';
import moment from 'moment';

interface ProgramOutcomesProps {
    data: ProgramClassOutcomes[];
}

export default function ProgramOutcomes({ data }: ProgramOutcomesProps) {
    const { theme } = useContext(ThemeContext);

    const completionsColor = theme === 'light' ? '#18ABA0' : '#61BAB2';
    const dropoutsColor = theme === 'light' ? '#9CA3AF' : '#6B7280';
    const xAxisLabelColor = theme === 'light' ? '#333' : '#ccc';
    const yAxisLabelColor = theme === 'light' ? '#333' : '#ccc';
    const formattedData = data.map((d) => {
        const month = moment(d.month, 'YYYY-MM');
        const monthAbbrev = month.format('MMM');
        return { ...d, month: monthAbbrev };
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={formattedData}
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
                    dataKey="drops"
                    stackId="a"
                    fill={dropoutsColor}
                    name="Drops"
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
