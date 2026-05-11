import { createBrowserRouter } from 'react-router-dom';
import { NonAdminRoutes, AdminRoutes, AllUserRoutes } from './app-routes';
import {
    KnowledgeCenterRoutes,
    KnowledgeCenterAdminRoutes
} from './knowledge-routes';
import { ProviderPlatformRoutes } from './provider-routes';
import {
    ProgramRoutes,
    AdminProgramRoutes,
    DeptAdminProgramRoutes
} from './program-routes';

export const router = createBrowserRouter([
    NonAdminRoutes,
    AdminRoutes,
    AllUserRoutes,
    KnowledgeCenterRoutes,
    KnowledgeCenterAdminRoutes,
    ProviderPlatformRoutes,
    ProgramRoutes,
    AdminProgramRoutes,
    DeptAdminProgramRoutes
]);
