import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles, AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import { getStudentLevel1Data } from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import ResidentHome from '@/pages/student/ResidentHome';
import KnowledgeCenterManagement from '@/pages/knowledge-center/KnowledgeCenterManagement';
import ResidentKnowledgeCenter from '@/pages/knowledge-center/ResidentKnowledgeCenter';
import LibraryViewer from '@/pages/knowledge-center/LibraryViewer';
import VideoViewer from '@/pages/knowledge-center/VideoViewer';
import type { RouteObject } from 'react-router-dom';

export const KnowledgeCenterAdminRoutes: RouteObject =
    declareAuthenticatedRoutes(
        [
            {
                path: 'knowledge-center-management',
                element: <KnowledgeCenterManagement />,
                handle: { title: 'Knowledge Center' }
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
                errorElement: <Error />
            },
            {
                path: 'viewer/videos/:id',
                element: <VideoViewer />,
                errorElement: <Error />
            }
        ],
        AllRoles,
        [FeatureAccess.OpenContentAccess]
    );
