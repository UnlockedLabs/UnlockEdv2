import { createBrowserRouter } from 'react-router-dom';
import AuthenticatedShell from '@/layouts/AuthenticatedShell';
import Error from '@/pages/Error';
import {
    NonAdminRoutes,
    AdminRoutes,
    AllUserRoutes,
    globalRoutes
} from './app-routes';
import {
    KnowledgeCenterRoutes,
    KnowledgeCenterAdminRoutes
} from './knowledge-routes';
import { LearningRecordRoutes } from './learning-record-routes';
import {
    ProgramRoutes,
    AdminProgramRoutes,
    DeptAdminProgramRoutes
} from './program-routes';
import { ProviderPlatformRoutes } from './provider-routes';
import { TutorRoutes } from './tutor-routes';

export const router = createBrowserRouter([
    {
        // Single shared shell: AuthProvider + context providers + nav layout,
        // mounted once. All authenticated route groups nest as children so the
        // nav bar persists and only the <Outlet/> content swaps on navigation.
        element: <AuthenticatedShell />,
        errorElement: <Error />,
        children: [
            NonAdminRoutes,
            AdminRoutes,
            AllUserRoutes,
            KnowledgeCenterRoutes,
            KnowledgeCenterAdminRoutes,
            LearningRecordRoutes,
            ProgramRoutes,
            AdminProgramRoutes,
            DeptAdminProgramRoutes,
            ProviderPlatformRoutes,
            TutorRoutes
        ]
    },
    // Public routes (login, reset-password, error, 404) — no authenticated shell.
    globalRoutes
]);
