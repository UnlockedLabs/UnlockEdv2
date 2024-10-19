import '@/bootstrap';
import '@/css/app.css';
import React from 'react';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
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
import LibraryViewer from './Pages/LibraryViewer';
import { checkDefaultFacility, checkExistingFlow, useAuth } from '@/useAuth';
import { UserRole } from '@/common';
import Loading from './Components/Loading';
import AuthenticatedLayout from './Layouts/AuthenticatedLayout.tsx';
import { PathValueProvider } from '@/PathValueCtx';

const WithAuth: React.FC = () => {
    return (
        <PathValueProvider>
            <AuthProvider>
                <Outlet />
            </AuthProvider>
        </PathValueProvider>
    );
};
const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return;
    }
    return user.role === UserRole.Admin ? (
        <div>{children}</div>
    ) : (
        <UnauthorizedNotFound which="unauthorized" />
    );
};

function WithAdmin() {
    return (
        <PathValueProvider>
            <AuthProvider>
                <AdminOnly>
                    <Outlet />
                </AdminOnly>
            </AuthProvider>
        </PathValueProvider>
    );
}

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
        path: '/',
        element: <WithAuth />,
        children: [
            {
                element: <AuthenticatedLayout />,
                children: [
                    {
                        path: 'dashboard',
                        element: <Dashboard />,
                        errorElement: <Error />,
                        handle: { title: 'Dashboard', path: ['dashboard'] }
                    },
                    {
                        path: 'consent',
                        element: <Consent />,
                        errorElement: <Error />,
                        handle: {
                            title: 'External Provider Consent',
                            path: ['consent']
                        }
                    },
                    {
                        path: 'my-courses',
                        element: <MyCourses />,
                        errorElement: <Error />,
                        handle: { title: 'My Courses', path: ['my-courses'] }
                    },
                    {
                        path: 'my-progress',
                        element: <MyProgress />,
                        errorElement: <Error />,
                        handle: { title: 'My Progress', path: ['my-progress'] }
                    },
                    {
                        path: 'course-catalog',
                        element: <CourseCatalog />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Course Catalog',
                            path: ['course-catalog']
                        }
                    },
                    {
                        path: 'open-content',
                        element: <OpenContent />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Open Content',
                            path: ['open-content']
                        }
                    },
                    {
                        path: 'viewer/libraries/:id',
                        element: <LibraryViewer />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Library Viewer',
                            path: ['viewer', 'libraries', ':id']
                        }
                    }
                ]
            },
            {
                path: '/reset-password',
                element: <ResetPassword />,
                errorElement: <Error />,
                loader: checkDefaultFacility
            }
        ]
    },
    {
        path: '/',
        element: <WithAdmin />,
        children: [
            {
                element: <AuthenticatedLayout />,
                children: [
                    {
                        path: 'student-management',
                        element: <StudentManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Student Management',
                            path: ['student-management']
                        }
                    },
                    {
                        path: 'admin-management',
                        element: <AdminManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Admin Management',
                            path: ['admin-management']
                        }
                    },
                    {
                        path: 'resources-management',
                        element: <ResourcesManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Resources Management',
                            path: ['resources-management']
                        }
                    },
                    {
                        path: 'provider-platform-management',
                        element: <ProviderPlatformManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Provider Platform Management',
                            path: ['provider-platform-management']
                        }
                    },
                    {
                        path: 'provider-users/:id',
                        element: <ProviderUserManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Provider User Management',
                            path: ['provider-platforms', ':id']
                        }
                    },
                    {
                        path: 'open-content-management',
                        element: <OpenContentManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Open Content Management',
                            path: ['open-content-management']
                        }
                    },
                    {
                        path: '*',
                        element: <UnauthorizedNotFound which="notFound" />
                    }
                ]
            }
        ]
    },
    {
        path: '/error',
        element: <Error />
    }
]);

export default function App() {
    if (import.meta.hot) {
        import.meta.hot.dispose(() => router.dispose());
    }

    return <RouterProvider router={router} fallbackElement={<Loading />} />;
}
