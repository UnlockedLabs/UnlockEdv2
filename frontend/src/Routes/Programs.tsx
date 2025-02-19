import { getFacilities } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess } from '@/common';
import { AdminRoles } from '@/useAuth';

const routes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'programs',
            id: 'programs-facilities',
            loader: getFacilities,
            element: <Programs />,
            handle: {
                title: 'Programs',
                path: ['programs']
            }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);

export const ProgramsRoutes = routes;
