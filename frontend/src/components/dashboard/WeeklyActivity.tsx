import {
    CartesianGrid,
    Line,
    LineChart,
    XAxis,
    YAxis
} from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from '@/components/ui/chart';
import { RecentActivity } from '@/types';

const chartConfig = {
    delta: {
        label: 'Minutes',
        color: '#556830'
    }
} satisfies ChartConfig;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeekData(data: RecentActivity[]): RecentActivity[] {
    const result: RecentActivity[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const found = data.find(
            (a) => a.date.split('T')[0] === dateString
        );
        result.push({
            date: dateString,
            delta: found ? Math.round(found.delta / 60) : 0
        });
    }

    return result;
}

function formatXAxisTick(value: string): string {
    const day = (new Date(value).getDay() + 1) % 7;
    return WEEKDAYS[day];
}

export default function WeeklyActivity({ data }: { data: RecentActivity[] }) {
    const chartData = buildWeekData(data);

    return (
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart
                data={chartData}
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tickFormatter={formatXAxisTick}
                    tick={{ fontSize: 12, fill: '#808080' }}
                />
                <YAxis
                    dataKey="delta"
                    label={{
                        value: 'Minutes',
                        style: { textAnchor: 'middle' },
                        angle: -90,
                        position: 'left',
                        offset: -5
                    }}
                    tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                    type="monotone"
                    dataKey="delta"
                    stroke="var(--color-delta)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                />
            </LineChart>
        </ChartContainer>
    );
}
