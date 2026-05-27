import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTHCALLBACK, hasFeature, useAuth } from '@/auth/useAuth';
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW, UserRole } from '@/types';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { ToastProvider } from '@/contexts/ToastContext';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

export default function RouteGuard({
    allowedRoles,
    features
}: {
    allowedRoles?: UserRole[];
    features?: FeatureAccess[];
}) {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            window.location.href = INIT_KRATOS_LOGIN_FLOW;
        }
    }, [user]);

    if (!user) {
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
