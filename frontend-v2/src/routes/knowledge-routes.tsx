import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import {
    getAdminLevel1Data,
    getLibraryLayoutData,
    getStudentLevel1Data
} from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import ResidentHome from '@/pages/student/ResidentHome';
import KnowledgeInsights from '@/pages/insights/KnowledgeInsights';
import OpenContent from '@/pages/knowledge-center/OpenContent';
import LibraryLayout from '@/pages/knowledge-center/LibraryLayout';
import VideoManagement from '@/pages/knowledge-center/VideoManagement';
import HelpfulLinksManagement from '@/pages/knowledge-center/HelpfulLinksManagement';
import VideoContent from '@/pages/knowledge-center/VideoContent';
import HelpfulLinks from '@/pages/knowledge-center/HelpfulLinks';
import Favorites from '@/pages/knowledge-center/Favorites';
import LibraryViewer from '@/pages/knowledge-center/LibraryViewer';
import VideoViewer from '@/pages/knowledge-center/VideoViewer';
import type { RouteObject } from 'react-router-dom';

export const KnowledgeCenterAdminRoutes: RouteObject =
    declareAuthenticatedRoutes(
        [
            {
                path: 'knowledge-insights',
                element: <KnowledgeInsights />,
                loader: getAdminLevel1Data,
                handle: { title: 'Knowledge Insights' }
            },
            {
                path: 'knowledge-center-management',
                element: <OpenContent />,
                loader: getLibraryLayoutData,
                handle: { title: 'Knowledge Center Management' },
                children: [
                    {
                        path: 'libraries',
                        loader: getLibraryLayoutData,
                        element: <LibraryLayout />,
                        errorElement: <Error />,
                        handle: { title: 'Libraries Management' }
                    },
                    {
                        path: 'videos',
                        element: <VideoManagement />,
                        handle: { title: 'Videos Management' }
                    },
                    {
                        path: 'helpful-links',
                        element: <HelpfulLinksManagement />,
                        handle: { title: 'Helpful Links Management' }
                    }
                ]
            }
        ],
        AdminRoles,
        [FeatureAccess.OpenContentAccess]
    );

export const KnowledgeCenterRoutes: RouteObject =
    declareAuthenticatedRoutes(
        [
            {
                path: 'home',
                element: <ResidentHome />,
                loader: getStudentLevel1Data,
                handle: { title: 'Home' }
            },
            {
                path: 'knowledge-center',
                element: <OpenContent />,
                loader: getLibraryLayoutData,
                handle: { title: 'Knowledge Center' },
                children: [
                    {
                        path: 'libraries',
                        loader: getLibraryLayoutData,
                        element: <LibraryLayout studentView />,
                        errorElement: <Error />,
                        handle: { title: 'Libraries' }
                    },
                    {
                        path: 'videos',
                        element: <VideoContent />,
                        errorElement: <Error />,
                        handle: { title: 'Videos' }
                    },
                    {
                        path: 'helpful-links',
                        element: <HelpfulLinks />,
                        handle: { title: 'Helpful Links' }
                    },
                    {
                        path: 'favorites',
                        element: <Favorites />,
                        errorElement: <Error />,
                        handle: { title: 'Favorites' }
                    }
                ]
            },
            {
                path: 'viewer/libraries/:id',
                element: <LibraryViewer />,
                errorElement: <Error />,
                handle: { title: 'Library Viewer' }
            },
            {
                path: 'viewer/videos/:id',
                element: <VideoViewer />,
                errorElement: <Error />,
                handle: { title: 'Video Viewer' }
            }
        ],
        AllRoles,
        [FeatureAccess.OpenContentAccess]
    );
