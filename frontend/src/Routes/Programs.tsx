import { getProgramData } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';
import ClassManagementForm from '@/Pages/ClassManagementForm';
import ProgramClassEnrollment from '@/Pages/ProgramClassEnrollment';

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
            path: 'programs/:id/class/:class_id?',
            element: <ClassManagementForm />,
            handle: {
                title: 'Class Details'
            }
        },
        {
            path: 'programs/:id/class-enrollment/:class_id',
            element: <ProgramClassEnrollment />,
            handle: { title: 'Add Resident' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
