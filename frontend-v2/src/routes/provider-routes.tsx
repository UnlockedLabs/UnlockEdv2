import type { RouteObject } from 'react-router-dom';
import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess, UserRole } from '@/types';
import { getStudentLayer2Data } from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import StudentDashboard from '@/pages/student/StudentDashboard';
import MyCourses from '@/pages/learning/MyCourses';
import MyProgress from '@/pages/learning/MyProgress';
import CourseCatalog from '@/pages/learning/CourseCatalog';
import LearningInsights from '@/pages/insights/LearningInsights';
import ProviderUserManagement from '@/pages/admin/ProviderUserManagement';
import ProviderPlatformManagement from '@/pages/admin/ProviderPlatformManagement';

const routes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-path',
            element: <StudentDashboard />,
            loader: getStudentLayer2Data,
            handle: { title: 'Learning Path' }
        },
        {
            path: 'my-courses',
            element: <MyCourses />,
            handle: { title: 'My Courses' }
        },
        {
            path: 'my-progress',
            element: <MyProgress />,
            handle: { title: 'My Progress' }
        },
        {
            path: 'course-catalog',
            element: <CourseCatalog />,
            handle: { title: 'Course Catalog' }
        }
    ],
    AllRoles,
    [FeatureAccess.ProviderAccess]
);

const adminRoutes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-insights',
            element: <LearningInsights />,
            errorElement: <Error />,
            handle: { title: 'Learning Insights' }
        },
        {
            path: 'provider-users/:id',
            element: <ProviderUserManagement />,
            handle: { title: 'Learning Platforms User Management' }
        },
        {
            path: 'course-catalog-admin',
            element: <CourseCatalog />,
            handle: { title: 'Course Catalog' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProviderAccess]
);

const deptAdminRoutes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-platforms',
            handle: { title: 'Learning Platforms' },
            element: <ProviderPlatformManagement />,
            errorElement: <Error />
        }
    ],
    [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes: RouteObject = {
    children: [routes, adminRoutes, deptAdminRoutes]
};
