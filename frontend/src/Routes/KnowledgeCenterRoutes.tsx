import { RouteObject } from 'react-router-dom';
import { DeclareAuthenticatedRoutes } from './Routes';
import AdminLayer1 from '@/Pages/AdminLayer1';
import {
    getAdminLevel1Data,
    getLibraryLayoutData,
    getStudentLevel1Data
} from '@/routeLoaders';
import LibraryLayout from '../Components/LibraryLayout';
import HelpfulLinks from '../Pages/HelpfulLinks';
import OpenContentManagement from '@/Pages/OpenContentManagement';
import Error from '@/Pages/Error';
import VideoManagement from '@/Pages/VideoManagement';
import HelpfulLinksManagement from '@/Pages/HelpfulLinksManagement';
import { FeatureAccess } from '@/common';
import { AdminRoles, AllRoles } from '@/useAuth';
import FavoritesPage from '@/Pages/Favorites';
import LibraryViewer from '@/Pages/LibraryViewer';
import VideoViewer from '@/Components/VideoEmbedViewer';
import VideoContent from '@/Components/VideoContent';
import OpenContent from '@/Pages/OpenContent';
import ResidentHome from '@/Pages/ResidentHome';

export const KnowledgeCenterAdminRoutes: RouteObject =
    DeclareAuthenticatedRoutes(
        [
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
                loader: getLibraryLayoutData,
                handle: {
                    title: 'Knowledge Center Management'
                },
                children: [
                    {
                        path: 'libraries',
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
        ],
        AdminRoles,
        [FeatureAccess.OpenContentAccess]
    );

export const KnowledgeCenterRoutes: RouteObject = DeclareAuthenticatedRoutes(
    [
        {
            path: 'home',
            element: <ResidentHome />,
            loader: getStudentLevel1Data,
            handle: {
                title: 'Home'
            }
        },
        {
            path: 'knowledge-center',
            element: <OpenContent />,
            loader: getLibraryLayoutData,
            handle: {
                title: 'Knowledge Center'
            },
            children: [
                {
                    path: 'libraries',
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
    ],
    AllRoles,
    [FeatureAccess.OpenContentAccess]
);
