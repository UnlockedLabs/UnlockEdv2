import type { RouteObject } from 'react-router-dom';
import { FeatureAccess, UserRole } from '@/types';
import RouteGuard from '@/auth/RouteGuard';
import Error from '@/pages/Error';

// Returns a pathless guard route. AuthProvider and the shared layout/nav are
// provided once by AuthenticatedShell at the router root (see routes/index.tsx),
// so these groups nest under it as children and only swap the <Outlet/> on
// navigation rather than remounting the whole page.
export function declareAuthenticatedRoutes(
    routes: RouteObject[],
    roles?: UserRole[],
    features?: FeatureAccess[]
): RouteObject {
    return {
        element: <RouteGuard allowedRoles={roles} features={features} />,
        errorElement: <Error />,
        children: routes
    };
}
