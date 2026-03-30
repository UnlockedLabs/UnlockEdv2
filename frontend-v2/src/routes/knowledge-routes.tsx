import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import {
    getAdminLevel1Data,
    getStudentLevel1Data
} from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import ResidentHome from '@/pages/student/ResidentHome';
import KnowledgeInsights from '@/pages/insights/KnowledgeInsights';
import KnowledgeCenterManagement from '@/pages/knowledge-center/KnowledgeCenterManagement';
import ResidentKnowledgeCenter from '@/pages/knowledge-center/ResidentKnowledgeCenter';
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
                element: <KnowledgeCenterManagement />,
                handle: { title: 'Knowledge Center Management' }
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
                element: <ResidentKnowledgeCenter />,
                handle: { title: 'Knowledge Center' }
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
