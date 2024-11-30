import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';

const EngagementRateGraph = ({
    active,
    inactive
}: {
    active: number;
    inactive: number;
}) => {
    const data = [
        { name: 'Active', value: active },
        { name: 'Inactive', value: inactive }
    ];
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
    return (
        <>
            <PieChart width={400} height={350}>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    label
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        </>
    );
};

export default EngagementRateGraph;
