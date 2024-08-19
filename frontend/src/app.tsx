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
            element: WithAuth({ children: <Dashboard /> }),
            errorElement: <Error />
        },
        {
            path: '/users',
            element: WithAdmin({ children: <Users /> }),
            errorElement: <Error />
        },
        {
            path: '/resources-management',
            element: WithAdmin({ children: <ResourcesManagement /> }),
            errorElement: <Error />
        },
        {
            path: '/reset-password',
            element: WithAuth({ children: <ResetPassword /> }),
            errorElement: <Error />
        },
        {
            path: '/consent',
            element: WithAuth({
                children: <Consent />
            }),
            errorElement: <Error />
        },
        {
            path: '/provider-platform-management',
            element: WithAdmin({ children: <ProviderPlatformManagement /> }),
            errorElement: <Error />
        },
        {
            path: '/my-courses',
            element: WithAuth({ children: <MyCourses /> }),
            errorElement: <Error />
        },
        {
            path: '/my-progress',
            element: WithAuth({ children: <MyProgress /> }),
            errorElement: <Error />
        },
        {
            path: '/course-catalog',
            element: WithAuth({ children: <CourseCatalog /> }),
            errorElement: <Error />
        },
        {
            path: '/provider-users/:providerId',
            element: WithAdmin({ children: <ProviderUserManagement /> }),
            errorElement: <Error />
        },
        {
            path: '/error',
            element: <Error />
        },
        {
            path: '/*',
            element: WithAuth({
                children: <UnauthorizedNotFound which="notFound" />
            })
        }
    ]);

    if (import.meta.hot) {
        import.meta.hot.dispose(() => router.dispose());
    }

    return (
        <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
    );
}
