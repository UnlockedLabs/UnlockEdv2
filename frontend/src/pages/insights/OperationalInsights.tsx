import { PageHeader } from '@/components/shared/PageHeader';
import OperationalInsightsCharts from '@/components/charts/OperationalInsightsCharts';

export default function OperationalInsightsPage() {
    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title="Operational Insights"
                    subtitle="Facility activity and user engagement metrics"
                />
                <OperationalInsightsCharts />
            </div>
        </div>
    );
}
