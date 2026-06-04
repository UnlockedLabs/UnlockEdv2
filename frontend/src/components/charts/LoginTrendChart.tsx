import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { DailyLoginCount } from '@/types';
import { BRAND, BRAND_DARK, SURFACE_HOVER } from '@/lib/brand';

interface LoginTrendChartProps {
    data: DailyLoginCount[];
}

interface TrendPoint {
    label: string;
    smoothed: number;
}

const SMOOTHING_WINDOW = 7;

function formatLabel(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00`);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

function buildPoints(data: DailyLoginCount[]): TrendPoint[] {
    return data.map((point, index) => {
        const windowStart = Math.max(0, index - (SMOOTHING_WINDOW - 1));
        const window = data.slice(windowStart, index + 1);
        const average =
            window.reduce((sum, item) => sum + item.total_logins, 0) /
            window.length;
        return {
            label: formatLabel(point.date),
            smoothed: Math.round(average)
        };
    });
}

export default function LoginTrendChart({ data }: LoginTrendChartProps) {
    const points = useMemo(() => buildPoints(data), [data]);
    const tickInterval = Math.max(0, Math.floor(points.length / 7));

    return (
        <ResponsiveContainer width="100%" height={220}>
            <LineChart
                data={points}
                margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_HOVER} />
                <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval}
                />
                <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#fff',
                        border: `1px solid ${SURFACE_HOVER}`,
                        borderRadius: 8,
                        fontSize: 12
                    }}
                    formatter={(value: number) => [
                        value.toLocaleString(),
                        '7-day avg'
                    ]}
                />
                <Line
                    type="monotone"
                    dataKey="smoothed"
                    name="7-day avg"
                    stroke={BRAND}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: BRAND_DARK }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
