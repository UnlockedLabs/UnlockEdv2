import { getProgramData } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';

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
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
