import AdminManagement from '@/Pages/AdminManagement';
import { DeclareAuthenticatedRoutes } from './Routes';
import Error from '@/Pages/Error';
import FacilityManagement from '@/Pages/FacilityManagement';
import { UserRole } from '@/common';
import OperationalInsightsPage from '@/Pages/OperationalInsights';
import StudentManagement from '@/Pages/StudentManagement';
import {
    AdminRoles,
    checkDefaultFacility,
    checkExistingFlow,
    checkRole
} from '@/useAuth';
import Consent from '@/Pages/Auth/Consent';
import StudentLayer0 from '@/Pages/StudentLayer0';
import ResetPassword from '@/Pages/Auth/ResetPassword';
import Welcome from '@/Pages/Welcome';
import Login from '@/Pages/Auth/Login';
import UnauthorizedNotFound from '@/Pages/Unauthorized';
import { getProviderPlatforms } from '@/routeLoaders';

const deptAdminRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'admins',
            element: <AdminManagement />,
            loader: getProviderPlatforms,
            errorElement: <Error />,
            handle: {
                title: 'Admins'
            }
        },
        {
            path: 'facilities',
            handle: {
                title: 'Facilities'
            },
            element: <FacilityManagement />,
            errorElement: <Error />
        }
    ],
    [UserRole.SystemAdmin, UserRole.DepartmentAdmin],
    []
);

export const globalRoutes = {
    children: [
        {
            path: '/',
            element: <Welcome />,
            errorElement: <Error />
        },
        {
            path: '/login',
            element: <Login />,
            errorElement: <Error />,
            loader: checkExistingFlow
        },
        {
            path: '*',
            element: <UnauthorizedNotFound which="notFound" />
        },
        {
            path: '/reset-password',
            element: <ResetPassword />,
            errorElement: <Error />,
            loader: checkDefaultFacility
        },
        {
            path: '/error',
            element: <Error />
        }
    ]
};

const adminRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'operational-insights',
            element: <OperationalInsightsPage />,
            errorElement: <Error />,
            handle: {
                title: 'Operational Insights'
            }
        },
        {
            path: 'residents',
            loader: getProviderPlatforms,
            element: <StudentManagement />,
            errorElement: <Error />,
            handle: {
                title: 'Residents'
            }
        }
    ],
    AdminRoles
);

const nonAdminLoggedInRoutes = DeclareAuthenticatedRoutes([
    {
        path: 'authcallback',
        loader: checkRole
    },
    {
        path: 'consent',
        element: <Consent />,
        handle: {
            title: 'External Provider Consent'
        }
    },
    {
        path: 'temp-home',
        element: <StudentLayer0 />,
        handle: {
            title: 'UnlockEd'
        }
    }
]);

export const AdminRoutes = {
    children: [deptAdminRoutes, adminRoutes]
};
export const NonAdminRoutes = {
    children: [nonAdminLoggedInRoutes, globalRoutes]
};
