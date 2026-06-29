import { Navigate, Outlet } from 'react-router-dom';
import { AUTHCALLBACK, hasFeature, useAuth } from '@/auth/useAuth';
import { FeatureAccess, UserRole } from '@/types';

export default function RouteGuard({
    allowedRoles,
    features
}: {
    allowedRoles?: UserRole[];
    features?: FeatureAccess[];
}) {
    const { user } = useAuth();

    // AuthProvider (mounted in AuthenticatedShell) guarantees a user before
    // children render, but guard defensively.
    if (!user) {
        return null;
    }
    if (
        (allowedRoles && !allowedRoles.includes(user.role)) ||
        (features && !hasFeature(user, ...features))
    ) {
        return <Navigate to={AUTHCALLBACK} />;
    }
    return <Outlet />;
}
