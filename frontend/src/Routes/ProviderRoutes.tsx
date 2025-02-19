import { RouteObject } from 'react-router-dom';
import { DeclareAuthenticatedRoutes } from './Routes';
import StudentLayer2 from '@/Pages/StudentDashboard';
import { getStudentLayer2Data } from '@/routeLoaders';
import MyCourses from '@/Pages/MyCourses';
import MyProgress from '@/Pages/MyProgress';
import { AdminRoles, AllRoles } from '@/useAuth';
import { FeatureAccess } from '@/common';
import AdminLayer2 from '@/Pages/AdminLayer2';
import Error from '@/Pages/Error';
import CourseCatalog from '@/Pages/CourseCatalog';
import ProviderUserManagement from '@/Pages/ProviderUserManagement';
import ProviderPlatformManagement from '@/Pages/ProviderPlatformManagement';

const routes: RouteObject = DeclareAuthenticatedRoutes(
    [
        {
            path: 'learning-path',
            element: <StudentLayer2 />,
            loader: getStudentLayer2Data,
            handle: {
                title: 'Learning Path'
            }
        },
        {
            path: 'my-courses',
            element: <MyCourses />,
            handle: {
                title: 'My Courses'
            }
        },
        {
            path: 'my-progress',
            element: <MyProgress />,
            handle: {
                title: 'My Progress'
            }
        }
    ],
    AllRoles,
    [FeatureAccess.ProviderAccess]
);

const adminRoutes: RouteObject = DeclareAuthenticatedRoutes(
    [
        {
            path: 'learning-insights',
            element: <AdminLayer2 />,
            errorElement: <Error />,
            handle: {
                title: 'Learning Insights'
            }
        },
        {
            path: 'learning-platforms',
            handle: {
                title: 'Learning Platforms'
            },
            element: <ProviderPlatformManagement />,
            errorElement: <Error />
        },
        {
            path: 'provider-users/:id',
            element: <ProviderUserManagement />,
            handle: {
                title: 'Learning Platforms User Management'
            }
        },
        {
            path: 'course-catalog-admin',
            element: <CourseCatalog />,
            handle: {
                title: 'Course Catalog'
            }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes: RouteObject = {
    children: [routes, adminRoutes]
};
