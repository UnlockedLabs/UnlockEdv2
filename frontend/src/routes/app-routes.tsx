import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import {
    AdminRoles,
    AllRoles,
    checkExistingFlow,
    checkRole,
    checkDefaultFacility
} from '@/auth/useAuth';
import { UserRole } from '@/types/user';
import { getProviderPlatforms } from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import Login from '@/pages/auth/Login';
import ResetPassword from '@/pages/auth/ResetPassword';
import Consent from '@/pages/auth/Consent';
import { Navigate } from 'react-router-dom';
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
import FeatureControl from '@/pages/admin/FeatureControl';
import FacilityFeatureControl from '@/pages/admin/FacilityFeatureControl';
import ResidentHome from '@/pages/student/ResidentHome';
import Exports from '@/pages/admin/Exports';
import { getStudentLevel1Data } from '@/loaders/routeLoaders';

const systemAdminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'feature-control',
            element: <FeatureControl />,
            errorElement: <Error />,
            handle: { title: 'Feature Control' }
        }
    ],
    [UserRole.SystemAdmin]
);

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
        },
        {
            path: 'facility-features',
            element: <FacilityFeatureControl />,
            errorElement: <Error />,
            handle: { title: 'Facility Features' }
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
            handle: { title: 'Insights' }
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
            handle: { title: 'Schedule' }
        },
        {
            path: 'exports',
            element: <Exports />,
            errorElement: <Error />,
            handle: { title: 'Exports' }
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
    },
    {
        path: 'home',
        element: <ResidentHome />,
        loader: getStudentLevel1Data,
        handle: { title: 'Home' }
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
            element: <Navigate to="/login" replace />,
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
    children: [systemAdminRoutes, deptAdminRoutes, adminRoutes]
};

export const AllUserRoutes = {
    children: [allUserRoutes]
};

// Authenticated routes only — these nest under AuthenticatedShell.
// globalRoutes (login, error, etc.) are public and registered separately
// in routes/index.tsx so they render without the authenticated layout.
export const NonAdminRoutes = {
    children: [nonAdminLoggedInRoutes]
};
