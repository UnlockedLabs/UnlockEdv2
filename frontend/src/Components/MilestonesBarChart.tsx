import {
    Bar,
    BarChart,
    CartesianGrid,
    Label,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { ThemeContext } from './ThemeContext';
import { useContext } from 'react';
import { CourseMilestones, YAxisTickProps } from '@/common';

const maxYAxisLabel = (props: YAxisTickProps) => {
    const fill = props.theme == 'light' ? '#666' : '#CCC';

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
                    fill={fill}
                >
                    {name.slice(0, 11)}
                </text>
                <text
                    x={x}
                    y={y + 15}
                    textAnchor="end"
                    fontSize={10}
                    fill={fill}
                >
                    {name.length > 20
                        ? name.slice(11, 20) + '...'
                        : name.slice(11, 20)}
                </text>
            </>
        );
    }
    return (
        <text x={x} y={y + 1} textAnchor="end" fontSize={10} fill={fill}>
            {name}
        </text>
    );
};

const MilestonesBarChart = ({ data }: { data: CourseMilestones[] }) => {
    const { theme } = useContext(ThemeContext);
    const fill = theme == 'light' ? '#666' : '#CCC';
    const barColor = theme == 'light' ? '#18ABA0' : '#61BAB2';
    const backgroundColor = theme == 'light' ? '#FFFFFF' : '#0F2926';

    const YAxisTick = (props: YAxisTickProps) => {
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
                <XAxis dataKey="milestones" type="number" stroke={fill}>
                    <Label value="Milestones" position="bottom" fill={fill} />
                </XAxis>
                <CartesianGrid strokeDasharray="3 3" stroke={fill} />
                <YAxis
                    dataKey={'name'}
                    type="category"
                    width={70}
                    tick={YAxisTick}
                    fill={fill}
                    // tick={<YAxisTick />} //TODO: why is this passed as an element and not a ref
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
