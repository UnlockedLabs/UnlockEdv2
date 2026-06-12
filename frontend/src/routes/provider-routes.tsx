import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AdminRoles } from '@/auth/useAuth';
import { FeatureAccess, UserRole } from '@/types';
import Error from '@/pages/Error';
import ProviderPlatformManagement from '@/pages/admin/ProviderPlatformManagement';
import ProviderPlatformDetail from '@/pages/admin/ProviderPlatformDetail';
import ProviderUserManagement from '@/pages/admin/ProviderUserManagement';

const providerAdminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'provider-users/:id',
            element: <ProviderUserManagement />,
            errorElement: <Error />,
            handle: { title: 'Learning Platform Users' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProviderAccess]
);

const providerDeptAdminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-platforms',
            element: <ProviderPlatformManagement />,
            errorElement: <Error />,
            handle: { title: 'Learning Platforms' }
        },
        {
            path: 'learning-platforms/:id',
            element: <ProviderPlatformDetail />,
            errorElement: <Error />,
            handle: { title: 'Learning Platform' }
        }
    ],
    [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes = {
    children: [providerAdminRoutes, providerDeptAdminRoutes]
};
