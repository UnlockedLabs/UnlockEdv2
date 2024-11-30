import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { LoginActivity } from '@/common';

const PeakLoginTimesChart = ({
    peak_login_times
}: {
    peak_login_times: LoginActivity[];
}) => {
    return (
        <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Peak Login Times</h3>
            <div className="flex flex-row gap-6">
                <BarChart width={600} height={300} data={peak_login_times}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time_interval"
                        tickFormatter={(tick: string) =>
                            new Date(tick).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_logins" fill="#96D5CE" />
                </BarChart>
            </div>
        </div>
    );
};
export default PeakLoginTimesChart;
