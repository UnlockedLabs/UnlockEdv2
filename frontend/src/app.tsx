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
import UnauthorizedNotFound from '@/Pages/Unauthorized';
import AdminManagement from '@/Pages/AdminManagement.tsx';
import StudentManagement from '@/Pages/StudentManagement.tsx';
import OpenContent from './Pages/OpenContent';
import LibraryViewer from './Pages/LibraryViewer';
import Programs from './Pages/Programs.tsx';
import LibraryLayout from './Components/LibraryLayout';
import VideoManagement from './Pages/VideoManagement';
import {
    AUTHCALLBACK,
    checkDefaultFacility,
    checkExistingFlow,
    checkRole,
    hasFeature,
    isAdministrator,
    useAuth
} from '@/useAuth';
import Loading from './Components/Loading';
import AuthenticatedLayout from './Layouts/AuthenticatedLayout.tsx';
import AdminLayer2 from './Pages/AdminLayer2.tsx';
import {
    getAdminLevel1Data,
    getFacilities,
    getLibraryLayoutData,
    getStudentLayer2Data,
    getStudentLevel1Data
} from './routeLoaders.ts';

import FacilityManagement from '@/Pages/FacilityManagement.tsx';
import { ToastProvider } from './Context/ToastCtx.tsx';
import VideoViewer from './Components/VideoEmbedViewer.tsx';
import VideoContent from './Components/VideoContent.tsx';
import OpenContentManagement from './Pages/OpenContentManagement.tsx';
import { FeatureAccess, INIT_KRATOS_LOGIN_FLOW } from './common.ts';
import FavoritesPage from './Pages/Favorites.tsx';
import StudentLayer1 from './Pages/StudentLayer1.tsx';
import OperationalInsightsPage from './Pages/OperationalInsights.tsx';
import HelpfulLinksManagement from './Pages/HelpfulLinksManagement.tsx';
import StudentLayer0 from './Pages/StudentLayer0.tsx';
import StudentLayer2 from './Pages/StudentDashboard.tsx';
import AdminLayer1 from './Pages/AdminLayer1.tsx';
import HelpfulLinks from './Pages/HelpfulLinks.tsx';
import { TitleManager } from './Components/TitleManager.tsx';

const WithAuth: React.FC = () => {
    return (
        <AuthProvider>
            <ToastProvider>
                <TitleManager />
                <Outlet />
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
        return <Navigate to={INIT_KRATOS_LOGIN_FLOW} />;
    }
    if (!allowedFeatures.every((feat) => hasFeature(user, feat))) {
        return <Navigate to={AUTHCALLBACK} />;
    }
    return <Outlet />;
}

function WithAdmin() {
    return (
        <AuthProvider>
            <ToastProvider>
                <AdminOnly>
                    <TitleManager />
                    <Outlet />
                </AdminOnly>
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
                        path: 'consent',
                        element: <Consent />,
                        handle: {
                            title: 'External Provider Consent'
                        }
                    },
                    {
                        path: 'home',
                        element: <StudentLayer0 />,
                        handle: {
                            title: 'UnlockEd'
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
                                path: 'trending-content',
                                element: <StudentLayer1 />,
                                loader: getStudentLevel1Data,
                                handle: {
                                    title: 'Trending Content'
                                }
                            },
                            {
                                path: 'knowledge-center',
                                element: <OpenContent />,
                                handle: {
                                    title: 'Knowledge Center'
                                },
                                children: [
                                    {
                                        path: 'libraries',
                                        loader: getLibraryLayoutData,
                                        element: <LibraryLayout />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Libraries'
                                        }
                                    },
                                    {
                                        path: 'videos',
                                        element: <VideoContent />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Videos'
                                        }
                                    },
                                    {
                                        path: 'helpful-links',
                                        element: <HelpfulLinks />,
                                        handle: {
                                            title: 'Helpful Links'
                                        }
                                    },
                                    {
                                        path: 'favorites',
                                        element: <FavoritesPage />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Favorites'
                                        }
                                    }
                                ]
                            },
                            {
                                path: 'viewer/libraries/:id',
                                element: <LibraryViewer />,
                                loader: getLibraryLayoutData,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Library Viewer'
                                }
                            },
                            {
                                path: 'viewer/videos/:id',
                                element: <VideoViewer />,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Video Viewer'
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
                                path: 'learning-path',
                                element: <StudentLayer2 />,
                                loader: getStudentLayer2Data,
                                handle: {
                                    title: 'Learning Path'
                                }
                            },
                            {
                                path: 'my-courses',
                                element: <MyCourses />,
                                handle: {
                                    title: 'My Courses'
                                }
                            },
                            {
                                path: 'my-progress',
                                element: <MyProgress />,
                                handle: {
                                    title: 'My Progress'
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
                id: 'admin',
                element: <AuthenticatedLayout />,
                loader: getFacilities,
                children: [
                    {
                        path: 'operational-insights',
                        element: <OperationalInsightsPage />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Operational Insights'
                        }
                    },
                    {
                        path: 'residents',
                        element: <StudentManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Residents'
                        }
                    },
                    {
                        path: 'admins',
                        element: <AdminManagement />,
                        errorElement: <Error />,
                        handle: {
                            title: 'Admins'
                        }
                    },
                    {
                        path: 'facilities',
                        element: <FacilityManagement />,
                        handle: {
                            title: 'Facilities'
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
                                path: 'learning-insights',
                                element: <AdminLayer2 />,
                                errorElement: <Error />,
                                handle: {
                                    title: 'Learning Insights'
                                }
                            },
                            {
                                path: 'learning-platforms',
                                element: <ProviderPlatformManagement />,
                                handle: {
                                    title: 'Learning Platforms'
                                }
                            },
                            {
                                path: 'provider-users/:id',
                                element: <ProviderUserManagement />,
                                handle: {
                                    title: 'Learning Platforms User Management'
                                }
                            },
                            {
                                path: 'course-catalog-admin',
                                element: <CourseCatalog />,
                                handle: {
                                    title: 'Course Catalog'
                                }
                            }
                        ]
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
                                path: 'knowledge-insights',
                                element: <AdminLayer1 />,
                                loader: getAdminLevel1Data,
                                handle: {
                                    title: 'Knowledge Insights'
                                }
                            },
                            {
                                path: 'knowledge-center-management',
                                element: <OpenContentManagement />,
                                handle: {
                                    title: 'Knowledge Center Management'
                                },
                                children: [
                                    {
                                        path: 'libraries',
                                        loader: getLibraryLayoutData,
                                        element: <LibraryLayout />,
                                        errorElement: <Error />,
                                        handle: {
                                            title: 'Libraries Management'
                                        }
                                    },
                                    {
                                        path: 'videos',
                                        element: <VideoManagement />,
                                        handle: {
                                            title: 'Videos Management'
                                        }
                                    },
                                    {
                                        path: 'helpful-links',
                                        element: <HelpfulLinksManagement />,
                                        handle: {
                                            title: 'Helpful Links Management'
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
