import type { RouteObject } from 'react-router-dom';
import { FeatureAccess, UserRole } from '@/types';
import { AuthProvider } from '@/auth/AuthProvider';
import RouteGuard from '@/auth/RouteGuard';
import Error from '@/pages/Error';

export function declareAuthenticatedRoutes(
    routes: RouteObject[],
    roles?: UserRole[],
    features?: FeatureAccess[]
): RouteObject {
    return {
        element: (
            <AuthProvider>
                <RouteGuard allowedRoles={roles} features={features} />
            </AuthProvider>
        ),
        errorElement: <Error />,
        children: routes
    };
}
