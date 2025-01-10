import { useMemo, useContext, useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import { ThemeContext } from '@/Context/ThemeContext';
import { ResponsiveContainer } from 'recharts';

interface EngagementRateGraphProps {
    peak_login_times: { time_interval: string; total_logins: number }[];
}

const EngagementRateGraph = ({
    peak_login_times
}: EngagementRateGraphProps) => {
    const { theme } = useContext(ThemeContext);

    const strokeColor = theme === 'light' ? '#666' : '#CCC';
    const lineColor = theme === 'light' ? '#18ABA0' : '#61BAB2';
    const backgroundColor = theme === 'light' ? '#FFFFFF' : '#0F2926';

    const [xTicks, setxTicks] = useState(2);
    useEffect(() => {
        const handleResize = () => {
            const width = window.outerWidth;
            if (width < 640) {
                setxTicks(8);
            } else if (width < 900) {
                setxTicks(6);
            } else {
                setxTicks(3);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const fullDayData = useMemo(() => {
        const hoursInDay = Array.from({ length: 24 }, (_, i) => i);
        const dataMap = new Map(
            hoursInDay.map((hour) => [
                hour,
                {
                    time: new Date(2023, 0, 1, hour, 0).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }),
                    logins: 0
                }
            ])
        );

        peak_login_times.forEach(({ time_interval, total_logins }) => {
            const date = new Date(time_interval);
            const localHour = date.getHours();
            const localTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            dataMap.set(localHour, {
                time: localTime,
                logins: total_logins
            });
        });

        return Array.from(dataMap.values());
    }, [peak_login_times]);
    return (
        <ResponsiveContainer width="100%" height="100%" className="pt-2">
            <LineChart
                data={fullDayData}
                margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
            >
                <CartesianGrid stroke={strokeColor} strokeDasharray="3 3" />

                <XAxis
                    dataKey="time"
                    interval={xTicks}
                    tickFormatter={(tick: string) => {
                        const [hours, minutes] = tick.split(':');
                        const date = new Date();
                        date.setHours(parseInt(hours), parseInt(minutes));
                        return date.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }}
                    stroke={strokeColor}
                    label={{
                        value: 'Time',
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
                        style: {
                            fill: strokeColor,
                            textAnchor: 'middle'
                        }
                    }}
                />
                <Tooltip
                    labelClassName="text-body"
                    contentStyle={{ backgroundColor: backgroundColor }}
                />
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
