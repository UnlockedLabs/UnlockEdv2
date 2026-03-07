import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip
} from 'recharts';

interface AttendanceTrendChartProps {
    data: { week: string; rate: number }[];
}

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <h3 className="text-base font-semibold text-[#203622] mb-2">
                    Attendance Trend
                </h3>
                <p className="text-sm text-gray-500">
                    No attendance data available
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h3 className="text-base font-semibold text-[#203622] mb-2">
                Attendance Trend
            </h3>
            <p className="text-sm text-gray-600 mb-3">
                Weekly attendance rate over the last 8 weeks
            </p>
            <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E5E7EB"
                    />
                    <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickLine={{ stroke: '#E5E7EB' }}
                        domain={[0, 100]}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                            fontSize: '12px'
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="#556830"
                        strokeWidth={2}
                        dot={{ fill: '#556830', r: 4 }}
                        name="Attendance Rate (%)"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
