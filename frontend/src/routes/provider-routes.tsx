import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AdminRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import Error from '@/pages/Error';

const providerAdminRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'provider-users/:id',
            lazy: () =>
                import('@/features/provider-platforms').then((m) => ({
                    Component: m.ProviderUserManagement
                })),
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
            lazy: () =>
                import('@/features/provider-platforms').then((m) => ({
                    Component: m.ProviderPlatformManagement
                })),
            errorElement: <Error />,
            handle: { title: 'Learning Platforms' }
        },
        {
            path: 'learning-platforms/:id',
            lazy: () =>
                import('@/features/provider-platforms').then((m) => ({
                    Component: m.ProviderPlatformDetail
                })),
            errorElement: <Error />,
            handle: { title: 'Learning Platform' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProviderAccess]
);

export const ProviderPlatformRoutes = {
    children: [providerAdminRoutes, providerDeptAdminRoutes]
};
