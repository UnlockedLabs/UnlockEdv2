import { getProgramData } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';
import SectionManagementForm from '@/Pages/SectionManagementForm';
import ProgramSectionEnrollment from '@/Pages/ProgramSectionEnrollment';

export const AdminProgramRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'programs',
            id: 'programs-facilities',
            loader: getProgramData,
            element: <Programs />,
            handle: {
                title: 'Programs Management',
                path: ['programs']
            }
        },
        {
            path: 'programs/detail',
            loader: getProgramData,
            element: <CreateProgramPage />,
            handle: {
                title: 'Program Details',
                path: ['programs', 'detail']
            }
        },

        {
            path: 'programs/:id',
            element: <ProgramOverviewDashboard />,
            handle: { title: 'Program Overview Dashboard' }
        },
        {
            path: 'programs/:id/class',
            element: <SectionManagementForm />,
            handle: {
                title: 'Class Details'
            }
        },
        {
            path: 'programs/:section_id/section-enrollment',
            element: <ProgramSectionEnrollment />,
            handle: { title: 'Add Resident' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
