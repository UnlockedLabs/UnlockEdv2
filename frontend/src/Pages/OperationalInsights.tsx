import { Facility } from '@/common';
import OperationalInsights from '@/Components/OperationalInsightsCharts';
import { useLoaderData } from 'react-router-dom';

export default function OperationalInsightsPage() {
    const facilities = useLoaderData() as Facility[];

    return (
        <div>
            <div className="w-full flex flex-col gap-6 px-5 pb-4">
                <OperationalInsights facilities={facilities} />
            </div>
        </div>
    );
}
