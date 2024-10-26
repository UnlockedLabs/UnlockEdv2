import '@/bootstrap';
import '@/css/app.css';
import React from 'react';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import Welcome from '@/Pages/Welcome';
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
import {
    fetchUserAuthInfo,
    checkExistingFlow,
    checkRole,
    useAuth
} from '@/useAuth';
import { UserRole } from '@/common';
import Loading from './Components/Loading';
import AuthenticatedLayout from './Layouts/AuthenticatedLayout.tsx';
import { PathValueProvider } from '@/PathValueCtx';
import AdminDashboard from './Pages/AdminDashboard.tsx';
import StudentDashboard from './Pages/StudentDashboard.tsx';
import GuestLayout from './Layouts/GuestLayout.tsx';
import { getOpenContentProviders } from './routeLoaders.ts';

const WithAuth: React.FC = () => {
    return (
        <AuthProvider>
            <PathValueProvider>
                <Outlet />
            </PathValueProvider>
        </AuthProvider>
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
        <AuthProvider>
            <PathValueProvider>
                <AdminOnly>
                    <Outlet />
                </AdminOnly>
            </PathValueProvider>
        </AuthProvider>
    );
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <Welcome />,
        errorElement: <Error />
    },
    {
        path: '/',
        element: <GuestLayout />,
        children: [
            {
                path: '/login',
                element: <Login />,
                errorElement: <Error />,
                loader: checkExistingFlow
            },
            {
                path: '/reset-password',
                element: <ResetPassword />,
                errorElement: <Error />,
                loader: fetchUserAuthInfo
            }
        ]
    },
    {
        path: '/',
        element: <WithAuth />,
        children: [
            {
                element: <AuthenticatedLayout />,
                errorElement: <Error />,
                children: [
                    {
                        path: 'authcallback',
                        loader: checkRole
                    },
                    {
                        path: 'student-dashboard',
                        element: <StudentDashboard />,
                        loader: getOpenContentProviders,
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
                        errorElement: <Error />,
                        element: <MyProgress />,
                        handle: { title: 'My Progress', path: ['my-progress'] }
                    },
                    {
                        path: 'course-catalog',
                        element: <CourseCatalog />,
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
                            path: ['viewer', 'libraries', ':library_name']
                        }
                    }
                ]
            }
        ]
    },
    {
        path: '/',
        element: <WithAdmin />,
        children: [
            {
                element: <AuthenticatedLayout />,
                errorElement: <Error />,
                children: [
                    {
                        path: 'admin-dashboard',
                        element: <AdminDashboard />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Admin Dashboard',
                            path: ['admin-dashboard', ':facility_name']
                        }
                    },
                    {
                        path: 'student-management',
                        element: <StudentManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Student Management',
                            path: ['student-management', ':facility_name']
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
                            path: [
                                'provider-platforms',
                                ':provider_platform_name'
                            ]
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
