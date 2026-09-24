import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
    ProgramLoadBucket,
    ProgramLoadDistribution,
    ServerResponseOne
} from '@/types';
import { Badge } from '@/components/ui/badge';
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
import {
    AllTimeBadge,
    SectionError,
    UpdatingBadge
} from './ProgramMatrixTable';
import { pct } from './programsUtils';

const LOAD_CHART_CONFIG: ChartConfig = {
    count: { label: 'Residents', color: 'var(--brand)' }
};

interface LoadDistributionSectionProps {
    selectedFacility: string;
    scopeLabel: string;
}

function loadStatewideInsight(buckets: ProgramLoadBucket[]): string {
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    const zero = buckets.find((b) => b.bucket === '0')?.count ?? 0;
    const multi = buckets
        .filter((b) => b.bucket !== '0' && b.bucket !== '1')
        .reduce((sum, b) => sum + b.count, 0);
    return `${pct(zero, total)}% of residents have zero active programs. ${pct(multi, total)}% are enrolled in 2 or more simultaneously.`;
}

export function LoadDistributionSection({
    selectedFacility,
    scopeLabel
}: LoadDistributionSectionProps) {
    const {
        data: loadResp,
        error,
        isValidating
    } = useSWR<ServerResponseOne<ProgramLoadDistribution>, Error>(
        `/api/department-metrics/programs/load-distribution?facility=${selectedFacility}`
    );

    if (error) {
        return <SectionError label="program load distribution" />;
    }

    if (!loadResp?.data) {
        return null;
    }

    return (
        <div
            className={`bg-card rounded-lg border border-border overflow-hidden transition-opacity ${isValidating ? 'opacity-60' : ''}`}
        >
            <div className="px-6 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-brand-dark dark:text-white text-lg font-medium">
                        Program Load Distribution
                    </h2>
                    <div className="flex items-center gap-3">
                        <UpdatingBadge show={isValidating} />
                        <AllTimeBadge />
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Concurrent active enrollments per resident
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-border border-t border-border">
                <div className="p-6">
                    <h3 className="text-brand-dark dark:text-white font-medium mb-1">
                        {scopeLabel}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {loadStatewideInsight(loadResp.data.statewide)}
                    </p>
                    <ChartContainer
                        config={LOAD_CHART_CONFIG}
                        className="h-56 w-full"
                    >
                        <BarChart data={loadResp.data.statewide}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="bucket"
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
                                dataKey="count"
                                fill="var(--color-count)"
                                radius={4}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ChartContainer>
                </div>
                <div className="border-t border-border md:border-t-0">
                    <div className="px-6 pt-5 pb-4">
                        <h3 className="text-brand-dark dark:text-white font-medium">
                            By Facility
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Facilities with high zero-load share have the most
                            capacity for new placements.
                        </p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Facility</TableHead>
                                <TableHead className="text-right">0</TableHead>
                                <TableHead className="text-right">1</TableHead>
                                <TableHead className="text-right">2</TableHead>
                                <TableHead className="text-right">3</TableHead>
                                <TableHead className="text-right">4+</TableHead>
                                <TableHead className="text-right pr-6">
                                    Total
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadResp.data.by_facility.map((row) => {
                                const zeroShare =
                                    row.total > 0 ? row.zero / row.total : 0;
                                const zeroShareTitle = `${Math.round(zeroShare * 100)}% of ${row.facility_name}'s residents have zero active programs`;
                                return (
                                    <TableRow key={row.facility_id}>
                                        <TableCell className="pl-6 font-medium text-brand-dark dark:text-white">
                                            {row.facility_name}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {zeroShare > 0.4 ? (
                                                <Badge
                                                    variant="outline"
                                                    className="badge-amber"
                                                    title={`${zeroShareTitle} — above the 40% capacity-flag threshold`}
                                                >
                                                    {row.zero}
                                                </Badge>
                                            ) : (
                                                <span
                                                    className="text-muted-foreground"
                                                    title={zeroShareTitle}
                                                >
                                                    {row.zero}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.one}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.two}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.three}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.four_plus}
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-medium text-brand-dark dark:text-white">
                                            {row.total}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
