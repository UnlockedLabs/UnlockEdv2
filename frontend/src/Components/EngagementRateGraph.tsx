import { useMemo, useContext, useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { ThemeContext } from '@/Context/ThemeContext';
import { UserEngagementTimes } from '@/common';

interface EngagementRateGraphProps {
    viewType: 'hourly' | 'daily';
    data: UserEngagementTimes[];
}

const EngagementRateGraph = ({ data, viewType }: EngagementRateGraphProps) => {
    const { theme } = useContext(ThemeContext);

    const strokeColor = theme === 'light' ? '#666' : '#CCC';
    const lineColor = theme === 'light' ? '#18ABA0' : '#61BAB2';
    const backgroundColor = theme === 'light' ? '#FFFFFF' : '#0F2926';

    const [xTicks, setXTicks] = useState(2);

    useEffect(() => {
        const handleResize = () => {
            const width = window.outerWidth;
            setXTicks(width < 640 ? 8 : width < 900 ? 6 : 3);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const processedData = useMemo(() => {
        if (viewType === 'daily') {
            const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);
            const dataMap = new Map(
                daysInMonth.map((day) => [
                    day,
                    { time: `Day ${day}`, logins: 0 }
                ])
            );

            data.forEach(({ time_interval, total_hours }) => {
                const date = new Date(time_interval);
                const dayOfMonth = date.getDate();
                dataMap.set(dayOfMonth, {
                    time: `Day ${dayOfMonth}`,
                    logins: total_hours ?? 0
                });
            });

            return Array.from(dataMap.values());
        } else {
            const hoursInDay = Array.from({ length: 24 }, (_, i) => i);
            const dataMap = new Map(
                hoursInDay.map((hour) => [
                    hour,
                    {
                        time: new Date(2023, 0, 1, hour, 0).toLocaleTimeString(
                            [],
                            { hour: '2-digit', minute: '2-digit', hour12: true }
                        ),
                        logins: 0
                    }
                ])
            );

            data.forEach(({ time_interval, total_hours }) => {
                const date = new Date(time_interval);
                const localHour = date.getHours();
                dataMap.set(localHour, {
                    time: date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }),
                    logins: total_hours ?? 0
                });
            });

            return Array.from(dataMap.values());
        }
    }, [data, viewType]);

    return (
        <ResponsiveContainer width="100%" height="100%" className="pt-2">
            <LineChart
                data={processedData}
                margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
            >
                <CartesianGrid stroke={strokeColor} strokeDasharray="3 3" />
                <XAxis
                    dataKey="time"
                    interval={xTicks}
                    stroke={strokeColor}
                    label={{
                        value: viewType === 'daily' ? 'Day' : 'Time',
                        style: { fill: strokeColor },
                        dy: 20,
                        zIndex: 100
                    }}
                />
                <YAxis
                    allowDecimals={false}
                    label={{
                        value: 'Logins',
                        angle: -90,
                        dx: -20,
                        style: { fill: strokeColor, textAnchor: 'middle' }
                    }}
                />
                <Tooltip contentStyle={{ backgroundColor }} />
                <Line
                    type="monotone"
                    dataKey="logins"
                    stroke={lineColor}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 3 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default EngagementRateGraph;
