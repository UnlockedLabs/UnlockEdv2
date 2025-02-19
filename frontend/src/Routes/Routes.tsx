import { TitleManager } from '../Components/TitleManager.tsx';
import { ToastProvider } from '../Context/ToastCtx.tsx';
import { AuthProvider } from '../Context/AuthContext';
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW, UserRole } from '../common';
import { Navigate, RouteObject } from 'react-router-dom';
import { AUTHCALLBACK, hasFeature, useAuth } from '@/useAuth.ts';
import Error from '@/Pages/Error.tsx';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.tsx';

export const RouteGuard: React.FC<{
    allowedRoles?: UserRole[];
    features?: FeatureAccess[];
}> = ({ allowedRoles, features }) => {
    const { user } = useAuth();
    if (!user) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        return;
    }
    if (
        (allowedRoles && !allowedRoles.includes(user.role)) ||
        (features && !hasFeature(user, ...features))
    ) {
        return <Navigate to={AUTHCALLBACK} />;
    }
    return LoggedInView();
};

export function DeclareAuthenticatedRoutes(
    routes: RouteObject[],
    roles?: UserRole[],
    features?: FeatureAccess[]
): RouteObject {
    return {
        element: (
            <AuthProvider
                children={
                    <RouteGuard allowedRoles={roles} features={features} />
                }
            />
        ),
        errorElement: <Error />,
        children: routes
    };
}

function LoggedInView() {
    return (
        <ToastProvider>
            <TitleManager />
            <AuthenticatedLayout />
        </ToastProvider>
    );
}
