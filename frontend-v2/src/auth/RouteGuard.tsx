import { Navigate } from 'react-router-dom';
import { AUTHCALLBACK, hasFeature, useAuth } from '@/auth/useAuth';
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW, UserRole } from '@/types';
import { AuthProvider } from '@/auth/AuthProvider';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { ToastProvider } from '@/contexts/ToastContext';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { RouteObject } from 'react-router-dom';
import Error from '@/pages/Error';

function RouteGuard({
    allowedRoles,
    features
}: {
    allowedRoles?: UserRole[];
    features?: FeatureAccess[];
}) {
    const { user } = useAuth();
    if (!user) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        return null;
    }
    if (
        (allowedRoles && !allowedRoles.includes(user.role)) ||
        (features && !hasFeature(user, ...features))
    ) {
        return <Navigate to={AUTHCALLBACK} />;
    }
    return (
        <ToastProvider>
            <PageTitleProvider>
                <BreadcrumbProvider>
                    <AuthenticatedLayout />
                </BreadcrumbProvider>
            </PageTitleProvider>
        </ToastProvider>
    );
}

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
