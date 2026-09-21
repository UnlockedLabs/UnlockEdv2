import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ProgramTypeEnrollment, ServerResponseMany } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from '@/components/ui/chart';
import { AllTimeBadge, SectionError } from './ProgramMatrixTable';
import { pct } from './programsUtils';

const TYPE_CHART_CONFIG: ChartConfig = {
    enrolled: { label: 'Enrolled', color: 'var(--brand)' }
};

export function EnrollmentByTypeSection() {
    const { data: enrollmentByTypeResp, error } = useSWR<
        ServerResponseMany<ProgramTypeEnrollment>,
        Error
    >('/api/department-metrics/programs/enrollment-by-type?facility=all');

    if (error) {
        return <SectionError label="enrollment by program type" />;
    }

    if (!enrollmentByTypeResp?.data || enrollmentByTypeResp.data.length === 0) {
        return null;
    }

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-brand-dark dark:text-white font-medium">
                    Enrollment by Program Type (Statewide)
                </h3>
                <AllTimeBadge />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
                {(() => {
                    const total = enrollmentByTypeResp.data.reduce(
                        (sum, r) => sum + r.enrolled,
                        0
                    );
                    const top = enrollmentByTypeResp.data.reduce((a, b) =>
                        b.enrolled > a.enrolled ? b : a
                    );
                    return `${top.program_type} accounts for ${pct(top.enrolled, total)}% of enrollments statewide with a ${Math.round(top.rate)}% completion rate.`;
                })()}
            </p>
            <ChartContainer config={TYPE_CHART_CONFIG} className="h-56 w-full">
                <BarChart data={enrollmentByTypeResp.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="program_type"
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                        dataKey="enrolled"
                        fill="var(--color-enrolled)"
                        radius={4}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ChartContainer>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="pl-6">Type</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right pr-6">Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {enrollmentByTypeResp.data.map((row) => (
                        <TableRow key={row.program_type}>
                            <TableCell className="pl-6 text-muted-foreground">
                                {row.program_type}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {row.enrolled.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {row.completed.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-brand"
                                            style={{
                                                width: `${row.rate}%`
                                            }}
                                        />
                                    </div>
                                    <span className="text-muted-foreground w-10 text-right">
                                        {Math.round(row.rate)}%
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
