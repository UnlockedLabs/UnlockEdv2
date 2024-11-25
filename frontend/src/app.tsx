import '@/bootstrap';
import '@/css/app.css';
import React from 'react';
import {
    Navigate,
    Outlet,
    RouterProvider,
    createBrowserRouter
} from 'react-router-dom';
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
import OpenContent from './Pages/OpenContent';
import LibraryViewer from './Pages/LibraryViewer';
import Programs from './Pages/Programs.tsx';
import LibraryLayout from './Components/LibraryLayout';
import VideoManagement from './Pages/VideoManagement';
import {
    checkDefaultFacility,
    checkExistingFlow,
    checkRole,
    hasFeature,
    isAdministrator,
    useAuth
} from '@/useAuth';
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
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW } from './common.ts';

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
    return isAdministrator(user) ? (
        <div>{children}</div>
    ) : (
        <UnauthorizedNotFound which="unauthorized" />
    );
};

function ProtectedRoute({
    allowedFeatures
}: {
    allowedFeatures: FeatureAccess[];
}) {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to={`${INIT_KRATOS_LOGIN_FLOW}`} />;
    }
    if (!allowedFeatures.every((feat) => hasFeature(user, feat))) {
        return <Navigate to="/authcallback" />;
    }
    return <Outlet />;
}

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
                        path: '',
                        element: (
                            <ProtectedRoute
                                allowedFeatures={[
                                    FeatureAccess.OpenContentAccess
                                ]}
                            />
                        ),
                        children: [
                            {
                                path: 'knowledge-center',
                                element: <OpenContent />,
                                handle: {
                                    title: 'Knowledge Center',
                                    path: ['knowledge-center', ':kind']
                                },
                                children: [
                                    {
                                        path: 'libraries',
                                        element: <LibraryLayout />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Libraries',
                                            path: [
                                                'knowledge-center',
                                                'libraries'
                                            ]
                                        }
                                    },
                                    {
                                        path: 'videos',
                                        element: <VideoContent />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Videos',
                                            path: ['knowledge-center', 'videos']
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
                                    path: [
                                        'viewer',
                                        'libraries',
                                        ':library_name'
                                    ]
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
                        path: '',
                        element: (
                            <ProtectedRoute
                                allowedFeatures={[FeatureAccess.ProviderAccess]}
                            />
                        ),
                        errorElement: <Error />,
                        children: [
                            {
                                path: 'my-courses',
                                element: <MyCourses />,
                                handle: {
                                    title: 'My Courses',
                                    path: ['my-courses']
                                }
                            },
                            {
                                path: 'my-progress',
                                element: <MyProgress />,
                                handle: {
                                    title: 'My Progress',
                                    path: ['my-progress']
                                }
                            },
                            {
                                path: 'course-catalog',
                                element: <CourseCatalog />,
                                handle: {
                                    title: 'Course Catalog',
                                    path: ['course-catalog']
                                }
                            }
                        ]
                    },
                    {
                        path: '',
                        element: (
                            <ProtectedRoute
                                allowedFeatures={[FeatureAccess.ProgramAccess]}
                            />
                        ),
                        errorElement: <Error />,
                        children: [
                            {
                                path: 'programs',
                                element: <Programs />,
                                loader: getFacilities,
                                handle: {
                                    title: 'Programs',
                                    path: ['programs']
                                }
                            }
                        ]
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
                        path: '',
                        element: (
                            <ProtectedRoute
                                allowedFeatures={[FeatureAccess.ProviderAccess]}
                            />
                        ),
                        errorElement: <Error />,
                        children: [
                            {
                                path: 'provider-platform-management',
                                element: <ProviderPlatformManagement />,
                                handle: {
                                    title: 'Provider Platform Management',
                                    path: ['provider-platform-management']
                                }
                            },
                            {
                                path: 'provider-users/:id',
                                element: <ProviderUserManagement />,
                                handle: {
                                    title: 'Provider User Management',
                                    path: [
                                        'provider-platforms',
                                        ':provider_platform_name'
                                    ]
                                }
                            },
                            {
                                path: 'course-catalog-admin',
                                element: <CourseCatalog />,
                                handle: {
                                    title: 'Course Catalog',
                                    path: ['course-catalog']
                                }
                            }
                        ]
                    },
                    {
                        path: 'facilities-management',
                        element: <FacilityManagement />,
                        handle: {
                            title: 'Facilities Management',
                            path: ['facilities-management']
                        }
                    },
                    {
                        path: '',
                        element: (
                            <ProtectedRoute
                                allowedFeatures={[
                                    FeatureAccess.OpenContentAccess
                                ]}
                            />
                        ),
                        errorElement: <Error />,
                        children: [
                            {
                                path: 'knowledge-center-management',
                                element: <OpenContentManagement />,
                                handle: {
                                    title: 'Knowledge Center Management',
                                    path: [
                                        'knowledge-center-management',
                                        ':kind'
                                    ]
                                },
                                children: [
                                    {
                                        path: 'libraries',
                                        element: <LibraryLayout />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Libraries',
                                            path: [
                                                'knowledge-center-management',
                                                'libraries'
                                            ]
                                        }
                                    },
                                    {
                                        path: 'videos',
                                        element: <VideoManagement />,
                                        handle: {
                                            title: 'Videos',
                                            path: [
                                                'knowledge-center-management',
                                                'videos'
                                            ]
                                        }
                                    }
                                ]
                            }
                        ]
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
