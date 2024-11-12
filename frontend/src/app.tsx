import '@/bootstrap';
import '@/css/app.css';
import React from 'react';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import Welcome from '@/Pages/Welcome';
import Login from '@/Pages/Auth/Login';
import ResetPassword from '@/Pages/Auth/ResetPassword';
import ProviderPlatformManagement from '@/Pages/ProviderPlatformManagement';
import { AuthProvider } from '@/Context/AuthContext';
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
import Programs from './Pages/Programs.tsx';
import LibraryLayout from './Components/LibraryLayout';
import VideoManagement from './Pages/VideoManagement';
import {
    checkDefaultFacility,
    checkExistingFlow,
    checkRole,
    useAuth
} from '@/useAuth';
import { UserRole } from '@/common';
import Loading from './Components/Loading';
import AuthenticatedLayout from './Layouts/AuthenticatedLayout.tsx';
import { PathValueProvider } from '@/Context/PathValueCtx';
import AdminDashboard from './Pages/AdminDashboard.tsx';
import StudentDashboard from './Pages/StudentDashboard.tsx';
import { getOpenContentProviders, getFacilities } from './routeLoaders.ts';

import FacilityManagement from '@/Pages/FacilityManagement.tsx';

import { ToastProvider } from './Context/ToastCtx.tsx';
import VideoViewer from './Components/VideoEmbedViewer.tsx';
import VideoContent from './Components/VideoContent.tsx';
import OpenContentManagement from './Pages/OpenContentManagement.tsx';

const WithAuth: React.FC = () => {
    return (
        <AuthProvider>
            <ToastProvider>
                <PathValueProvider>
                    <Outlet />
                </PathValueProvider>
            </ToastProvider>
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
            <ToastProvider>
                <PathValueProvider>
                    <AdminOnly>
                        <Outlet />
                    </AdminOnly>
                </PathValueProvider>
            </ToastProvider>
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
        path: '/login',
        element: <Login />,
        errorElement: <Error />,
        loader: checkExistingFlow
    },
    {
        path: '/',
        element: <WithAuth />,
        errorElement: <Error />,
        children: [
            {
                element: <AuthenticatedLayout />,
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
                        handle: {
                            title: 'External Provider Consent',
                            path: ['consent']
                        }
                    },
                    {
                        path: 'my-courses',
                        element: <MyCourses />,
                        handle: { title: 'My Courses', path: ['my-courses'] }
                    },
                    {
                        path: 'my-progress',
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
                        path: 'programs',
                        element: <Programs />,
                        loader: getFacilities,
                        errorElement: <Error />,
                        handle: {
                            title: 'Programs',
                            path: ['programs']
                        }
                    },
                    {
                        path: 'open-content',
                        element: <OpenContent />,
                        handle: {
                            title: 'Open Content',
                            path: ['open-content', ':kind']
                        },
                        children: [
                            {
                                path: 'libraries',
                                element: <LibraryLayout />,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Libraries',
                                    path: ['open-content', 'libraries']
                                }
                            },
                            {
                                path: 'videos',
                                element: <VideoContent />,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Videos',
                                    path: ['open-content', 'videos']
                                }
                            }
                        ]
                    },
                    {
                        path: 'viewer/libraries/:id',
                        element: <LibraryViewer />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Library Viewer',
                            path: ['viewer', 'libraries', ':library_name']
                        }
                    },
                    {
                        path: 'viewer/videos/:id',
                        element: <VideoViewer />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Video Viewer',
                            path: ['viewer', 'videos', ':video_name']
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
                loader: getFacilities,
                children: [
                    {
                        path: 'admin-dashboard',
                        element: <AdminDashboard />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Admin Dashboard',
                            path: ['admin-dashboard']
                        }
                    },
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
                            path: [
                                'provider-platforms',
                                ':provider_platform_name'
                            ]
                        }
                    },
                    {
                        path: 'facilities-management',
                        element: <FacilityManagement />,
                        handle: {
                            title: 'Facilities Management',
                            path: ['facilities-management']
                        },
                        errorElement: <Error />
                    },
                    {
                        path: 'open-content-management',
                        element: <OpenContentManagement />,
                        handle: {
                            title: 'Open Content Management',
                            path: ['open-content-management', ':kind']
                        },
                        children: [
                            {
                                path: 'libraries',
                                element: <LibraryLayout />,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Libraries',
                                    path: ['open-content', 'libraries']
                                }
                            },
                            {
                                path: 'videos',
                                element: <VideoManagement />,
                                handle: {
                                    title: 'Videos',
                                    path: ['open-content-management', 'videos']
                                }
                            },
                            {}
                        ]
                    },
                    {
                        path: 'course-catalog-admin',
                        element: <CourseCatalog />,
                        handle: {
                            title: 'Course Catalog',
                            path: ['course-catalog']
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
