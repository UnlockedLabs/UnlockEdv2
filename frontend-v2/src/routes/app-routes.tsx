import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles, checkExistingFlow, checkRole, checkDefaultFacility } from '@/auth/useAuth';
import { UserRole } from '@/types';
import { getProviderPlatforms } from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import Login from '@/pages/auth/Login';
import ResetPassword from '@/pages/auth/ResetPassword';
import Consent from '@/pages/auth/Consent';
import Welcome from '@/pages/Welcome';
import StudentLayer0 from '@/pages/student/StudentLayer0';
import AdminManagement from '@/pages/admin/AdminManagement';
import FacilityManagement from '@/pages/admin/FacilityManagement';
import StudentManagement from '@/pages/admin/StudentManagement';
import ResidentProfile from '@/pages/admin/ResidentProfile';
import Schedule from '@/pages/Schedule';
import Dashboard from '@/pages/Dashboard';
import OperationalInsights from '@/pages/insights/OperationalInsights';
import FAQs from '@/pages/FAQs';
import HelpCenter from '@/pages/HelpCenter';

const deptAdminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'admins',
            element: <AdminManagement />,
            loader: getProviderPlatforms,
            errorElement: <Error />,
            handle: { title: 'Admins' }
        },
        {
            path: 'facilities',
            handle: { title: 'Facilities' },
            element: <FacilityManagement />,
            errorElement: <Error />
        }
    ],
    [UserRole.SystemAdmin, UserRole.DepartmentAdmin]
);

const adminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'dashboard',
            element: <Dashboard />,
            errorElement: <Error />,
            handle: { title: 'Dashboard' }
        },
        {
            path: 'operational-insights',
            element: <OperationalInsights />,
            errorElement: <Error />,
            handle: { title: 'Operational Insights' }
        },
        {
            path: 'residents',
            loader: getProviderPlatforms,
            element: <StudentManagement />,
            errorElement: <Error />,
            handle: { title: 'Residents' }
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
            handle: { title: 'Facility Schedule' }
        }
    ],
    AdminRoles
);

const nonAdminLoggedInRoutes = declareAuthenticatedRoutes([
    {
        path: 'authcallback',
        loader: checkRole
    },
    {
        path: 'consent',
        element: <Consent />,
        handle: { title: 'External Provider Consent' }
    },
    {
        path: 'temp-home',
        element: <StudentLayer0 />,
        handle: { title: 'UnlockEd' }
    }
]);

const allUserRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'faqs',
            element: <FAQs />,
            handle: { title: 'FAQs' }
        },
        {
            path: 'help',
            element: <HelpCenter />,
            handle: { title: 'Help Center' }
        }
    ],
    AllRoles
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

export const AdminRoutes = {
    children: [deptAdminRoutes, adminRoutes]
};

export const AllUserRoutes = {
    children: [allUserRoutes]
};

export const NonAdminRoutes = {
    children: [nonAdminLoggedInRoutes, globalRoutes]
};
