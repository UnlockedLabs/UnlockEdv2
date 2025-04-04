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
import { LoginActivity, UserEngagementTimes } from '@/common';

interface EngagementRateGraphProps {
    viewType: 'peakLogin' | 'userEngagement';
    data: LoginActivity[] | UserEngagementTimes[];
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

    const generateHourlyLabels = (): string[] => {
        return Array.from({ length: 24 }, (_, hour) =>
            new Date(0, 0, 0, hour).toLocaleTimeString('en-US', {
                hour: 'numeric',
                hour12: true
            })
        );
    };

    const processPeakLoginData = (rawData: LoginActivity[]) => {
        const hourlyLabels = generateHourlyLabels();
        const loginsByHour: number[] = Array.from({ length: 24 }, () => 0);

        rawData.forEach((item) => {
            const date = new Date(item.time_interval);
            const hour = date.getHours();
            loginsByHour[hour] += item.total_logins;
        });

        return hourlyLabels.map((label, hour) => ({
            hour: label,
            logins: loginsByHour[hour]
        }));
    };

    const generateLast30Days = (): string[] => {
        const today = new Date();
        return Array.from({ length: 30 }, (_, i) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (30 - i));
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        });
    };

    const processUserEngagementData = (rawData: UserEngagementTimes[]) => {
        const last30Days = generateLast30Days();
        const dataMap = rawData.reduce<Record<string, number>>((map, item) => {
            const date = new Date(item.time_interval);
            const key = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
            }).format(date);
            map[key] = parseFloat(item.total_hours.toFixed(2));
            return map;
        }, {});

        return last30Days.map((date) => ({
            date,
            hours: dataMap[date] || 0
        }));
    };

    const processedData = useMemo(() => {
        if (viewType === 'peakLogin') {
            return processPeakLoginData(data as LoginActivity[]);
        } else if (viewType === 'userEngagement') {
            return processUserEngagementData(data as UserEngagementTimes[]);
        }
        return [];
    }, [data, viewType]);

    const yAxisLabel = viewType === 'peakLogin' ? 'Logins' : 'Hours';

    return (
        <ResponsiveContainer width="100%" height="100%" className="pt-2">
            <LineChart
                data={processedData}
                margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
            >
                <CartesianGrid stroke={strokeColor} strokeDasharray="3 3" />
                <XAxis
                    dataKey={viewType === 'peakLogin' ? 'hour' : 'date'}
                    interval={xTicks}
                    stroke={strokeColor}
                    label={{
                        value:
                            viewType === 'peakLogin'
                                ? 'Time of day'
                                : 'Last 30 days',
                        style: { fill: strokeColor },
                        dy: 20,
                        zIndex: 100
                    }}
                />
                <YAxis
                    allowDecimals={false}
                    label={{
                        value: yAxisLabel,
                        angle: -90,
                        dx: -20,
                        style: { fill: strokeColor, textAnchor: 'middle' }
                    }}
                />
                <Tooltip contentStyle={{ backgroundColor }} />
                <Line
                    type="monotone"
                    dataKey={viewType === 'peakLogin' ? 'logins' : 'hours'}
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
