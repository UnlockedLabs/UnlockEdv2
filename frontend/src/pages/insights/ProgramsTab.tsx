import useSWR from 'swr';
import { ProgramEngagementOverview, ServerResponseOne } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InsightsDateParams, dateQuery } from './insightsRange';
import { EngagementOverviewSection } from './EngagementOverviewSection';
import { SecondEnrollmentSection } from './SecondEnrollmentSection';
import { CompletionMatrixSection } from './CompletionMatrixSection';
import { LoadDistributionSection } from './LoadDistributionSection';
import { EnrollmentByTypeSection } from './EnrollmentByTypeSection';
import { pct } from './programsUtils';

interface ProgramsTabProps {
    dateParams: InsightsDateParams;
    selectedFacility: string;
    rangeLabel: string;
}

export default function ProgramsTab({
    dateParams,
    selectedFacility,
    rangeLabel
}: ProgramsTabProps) {
    const query = `facility=${selectedFacility}&${dateQuery(dateParams)}`;

    const { data: engagementResp, isLoading: engagementLoading } = useSWR<
        ServerResponseOne<ProgramEngagementOverview>
    >(`/api/department-metrics/programs/engagement-overview?${query}`);

    if (engagementLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-lg" />
            </div>
        );
    }

    const engagement = engagementResp?.data;
    if (!engagement) {
        return (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
                No program data available for this selection.
            </div>
        );
    }

    const neverEngagedPct = pct(
        engagement.never_engaged_residents,
        engagement.total_residents
    );
    const topProgram = engagement.top_programs[0];

    return (
        <div className="space-y-6">
            <EngagementOverviewSection
                engagement={engagement}
                rangeLabel={rangeLabel}
            />
            <SecondEnrollmentSection selectedFacility={selectedFacility} />
            <CompletionMatrixSection selectedFacility={selectedFacility} />
            <LoadDistributionSection selectedFacility={selectedFacility} />
            <EnrollmentByTypeSection />

            {topProgram && (
                <Alert
                    role="note"
                    className="border-amber-200 bg-amber-50 dark:bg-amber-900/20"
                >
                    <AlertTitle className="text-foreground">
                        Action item
                    </AlertTitle>
                    <AlertDescription>
                        <span className="text-sm leading-relaxed">
                            {neverEngagedPct}% of residents have never engaged
                            with a program. {topProgram.program_name} leads at{' '}
                            {Math.round(topProgram.completion_rate)}% completion
                            — consider outreach to never-engaged residents
                            before adding new program capacity.
                        </span>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
