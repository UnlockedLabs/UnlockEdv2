import { useAuth, isSysAdmin } from '@/auth/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import GlobalFeatureSection from '@/pages/admin/feature-control/GlobalFeatureSection';
import FacilityFeatureSection from '@/pages/admin/feature-control/FacilityFeatureSection';

// Single Feature Control page for System + Department admins.
// - Department admin: only the per-facility controls.
// - System admin: the statewide masters on top, per-facility controls below.
export default function FeatureControl() {
    const { user } = useAuth();
    if (!user) return null;
    const sysAdmin = isSysAdmin(user);

    return (
        <div className="p-6 space-y-8">
            <PageHeader
                title="Feature Control"
                subtitle={
                    sysAdmin
                        ? 'Manage statewide defaults and per-facility settings'
                        : 'Turn features on or off for each facility'
                }
            />
            {sysAdmin && <GlobalFeatureSection />}
            <FacilityFeatureSection
                heading={sysAdmin ? 'Per-Facility Settings' : undefined}
            />
        </div>
    );
}
