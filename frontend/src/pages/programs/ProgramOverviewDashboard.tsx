import ProgramOverviewFacilityAdmin from '@/pages/programs/ProgramOverviewFacilityAdmin';
import ProgramOverviewStatewide from '@/pages/programs/ProgramOverviewStatewide';
import { canSwitchFacility, useAuth } from '@/auth/useAuth';
import { useSearchParams } from 'react-router-dom';

export default function ProgramOverviewDashboard() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const showStatewideView = user ? canSwitchFacility(user) : false;
    const facilityOverride = searchParams.get('facility_id');

    return showStatewideView && !facilityOverride ? (
        <ProgramOverviewStatewide />
    ) : (
        <ProgramOverviewFacilityAdmin />
    );
}
