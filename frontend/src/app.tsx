import '@/bootstrap';
import '@/css/app.css';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Welcome from '@/Pages/Welcome';
import Dashboard from '@/Pages/Dashboard';
import Login from '@/Pages/Auth/Login';
import Users from '@/Pages/Users';
import ResetPassword from '@/Pages/Auth/ResetPassword';
import ProviderPlatformManagement from './Pages/ProviderPlatformManagement';
import { AdminOnly, AuthProvider } from './AuthContext';
import Consent from './Pages/Auth/Consent';
import MyCourses from './Pages/MyCourses';
import MyProgress from './Pages/MyProgress';
import CourseCatalog from './Pages/CourseCatalog';
import ProviderUserManagement from './Pages/ProviderUserManagement';
import Error from './Pages/Error';
import ResourcesManagement from './Pages/ResourcesManagement';
import UnauthorizedNotFound from './Pages/Unauthorized';

function WithAuth({ children }) {
    return <AuthProvider>{children}</AuthProvider>;
}

function WithAdmin({ children }) {
    return (
        <WithAuth>
            <AdminOnly>{children}</AdminOnly>
        </WithAuth>
    );
}

export default function App() {
    const router = createBrowserRouter([
        {
            path: '/',
            element: <Welcome />,
            errorElement: <Error />
        },
        {
            path: '/login',
            element: <Login />,
            errorElement: <Error />
        },
        {
            path: '/dashboard',
            element: (
                <WithAuth>
                    <Dashboard />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/users',
            element: (
                <WithAdmin>
                    <Users />
                </WithAdmin>
            ),
            errorElement: <Error />
        },
        {
            path: '/resources-management',
            element: (
                <WithAdmin>
                    <ResourcesManagement />
                </WithAdmin>
            ),
            errorElement: <Error />
        },
        {
            path: '/reset-password',
            element: (
                <WithAuth>
                    <ResetPassword />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/consent',
            element: (
                <WithAuth>
                    <Consent />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/provider-platform-management',
            element: (
                <WithAdmin>
                    <ProviderPlatformManagement />
                </WithAdmin>
            ),
            errorElement: <Error />
        },
        {
            path: '/my-courses',
            element: (
                <WithAuth>
                    <MyCourses />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/my-progress',
            element: (
                <WithAuth>
                    <MyProgress />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/course-catalog',
            element: (
                <WithAuth>
                    <CourseCatalog />
                </WithAuth>
            ),
            errorElement: <Error />
        },
        {
            path: '/provider-users/:providerId',
            element: (
                <WithAdmin>
                    <ProviderUserManagement />
                </WithAdmin>
            ),
            errorElement: <Error />
        },
        {
            path: '/error',
            element: <Error />
        },
        {
            path: '/*',
            element: (
                <WithAuth>
                    <UnauthorizedNotFound which="notFound" />
                </WithAuth>
            ),
            errorElement: <Error />
        }
    ]);

    if (import.meta.hot) {
        import.meta.hot.dispose(() => router.dispose());
    }

    return (
        <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
    );
}
