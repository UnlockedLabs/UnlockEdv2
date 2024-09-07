import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Label
} from 'recharts';
import { ThemeContext } from './ThemeContext';
import { useContext } from 'react';
import { ProgramMilestones } from '@/common';

const MilestonesBarChart = ({ data }: { data: ProgramMilestones[] }) => {
    const { theme } = useContext(ThemeContext);

    var barColor = theme == 'light' ? '#18ABA0' : '#61BAB2';
    var backgroundColor = theme == 'light' ? '#FFFFFF' : '#0F2926';

    const maxYAxisLabel = (props) => {
        const { x, y, payload } = props;
        const name = payload.value;
        if (name.length > 10) {
            return (
                <>
                    <text
                        x={x}
                        y={y + 1}
                        textAnchor="end"
                        fontSize={10}
                        fill="#666"
                    >
                        {name.slice(0, 11)}
                    </text>
                    <text
                        x={x}
                        y={y + 15}
                        textAnchor="end"
                        fontSize={10}
                        fill="#666"
                    >
                        {name.length > 20
                            ? name.slice(11, 20) + '...'
                            : name.slice(11, 20)}
                    </text>
                </>
            );
        }
        return (
            <text x={x} y={y + 1} textAnchor="end" fontSize={10} fill="#666">
                {name}
            </text>
        );
    };

    const YAxisTick = (props: any) => {
        return <g>{maxYAxisLabel(props)}</g>;
    };

    const safeData =
        data && data.length > 0 ? data : [{ name: 'No data', milestones: 0 }];
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                layout="vertical"
                data={safeData}
                margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="milestones" type="number">
                    <Label value="Milestones" position="bottom" />
                </XAxis>
                <YAxis
                    dataKey={'name'}
                    type="category"
                    width={70}
                    tick={<YAxisTick />}
                />
                <Tooltip
                    labelClassName="text-body"
                    contentStyle={{ backgroundColor: backgroundColor }}
                    cursor={{ opacity: 0.3 }}
                />
                <Bar dataKey="milestones" fill={barColor} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default MilestonesBarChart;
