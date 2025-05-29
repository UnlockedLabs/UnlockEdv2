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
import { getProviderPlatforms } from '@/routeLoaders';
import ResidentProfile from '@/Pages/ResidentProfile';
import Schedule from '@/Pages/Schedule';

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
            element: <Error type="not-found" />
        },
        {
            path: '/404',
            element: <Error type="not-found" />
        },
        {
            path: '/unauthorized',
            element: <Error type="unauthorized" back />
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
        },
        {
            path: 'residents/:user_id',
            element: <ResidentProfile />,
            handle: {
                title: 'Resident Profile',
                path: ['residents']
            }
        },
        {
            path: 'schedule',
            element: <Schedule />,
            handle: {
                title: 'Facility Schedule'
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
