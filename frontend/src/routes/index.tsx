import { createBrowserRouter } from 'react-router-dom';
import { NonAdminRoutes, AdminRoutes, AllUserRoutes } from './app-routes';
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

export const router = createBrowserRouter([
    NonAdminRoutes,
    AdminRoutes,
    AllUserRoutes,
    KnowledgeCenterRoutes,
    KnowledgeCenterAdminRoutes,
    LearningRecordRoutes,
    ProgramRoutes,
    AdminProgramRoutes,
    DeptAdminProgramRoutes
]);
