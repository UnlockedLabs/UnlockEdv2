import '@/bootstrap';
import '@/css/app.css';
import React from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Welcome from '@/Pages/Welcome';
import Dashboard from '@/Pages/Dashboard';
import Login from '@/Pages/Auth/Login';
import ResetPassword from '@/Pages/Auth/ResetPassword';
import ProviderPlatformManagement from '@/Pages/ProviderPlatformManagement';
import { AuthProvider } from '@/AuthContext';
import Consent from '@/Pages/Auth/Consent';
import MyCourses from '@/Pages/MyCourses';
import MyProgress from '@/Pages/MyProgress';
import CourseCatalog from '@/Pages/CourseCatalog';
import ProviderUserManagement from '@/Pages/ProviderUserManagement';
import Error from '@/Pages/Error';
import ResourcesManagement from '@/Pages/ResourcesManagement';
import UnauthorizedNotFound from '@/Pages/Unauthorized';
import AdminManagement from '@/Pages/AdminManagement.tsx';
import StudentManagement from '@/Pages/StudentManagement.tsx';
import OpenContentManagement from './Pages/OpenContentManagement';
import OpenContent from './Pages/OpenContent';
import { checkDefaultFacility, checkExistingFlow, useAuth } from '@/useAuth';
import { UserRole } from '@/common';
import LibraryViewer from './Pages/LibraryViewer';
import { checkDefaultFacility, checkExistingFlow, useAuth } from '@/useAuth';
import { UserRole } from '@/common';

function WithAuth({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
}

const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return;
    }
    if (user.role === UserRole.Admin) {
        return <div>{children}</div>;
    } else {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
};

function WithAdmin({ children }: { children: React.ReactNode }) {
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
            errorElement: <Error />,
            loader: checkExistingFlow
        },
        {
            path: '/dashboard',
            element: WithAuth({ children: <Dashboard /> }),
            errorElement: <Error />
        },
        {
            path: '/student-management',
            element: WithAdmin({ children: <StudentManagement /> }),
            errorElement: <Error />
        },
        {
            path: '/admin-management',
            element: WithAdmin({ children: <AdminManagement /> }),
            errorElement: <Error />
        },
        {
            path: '/open-content-management',
            element: WithAdmin({ children: <OpenContentManagement /> }),
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
            errorElement: <Error />,
            loader: checkDefaultFacility
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
            path: '/open-content',
            element: WithAuth({ children: <OpenContent /> }),
            errorElement: <Error />
        },
        {
            path: '/viewer/libraries/:id',
            element: WithAuth({ children: <LibraryViewer /> }),
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
