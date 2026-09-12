import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { FeatureAccess, UserRole } from '@/types';
import AiTutor from '@/pages/AiTutor';
import type { RouteObject } from 'react-router-dom';

export const TutorRoutes: RouteObject = declareAuthenticatedRoutes(
    [{ path: 'ai-tutor', element: <AiTutor />, handle: { title: 'AI Tutor' } }],
    // Resident-only: the MVP (ID-868) ships no staff experience inside the
    // tutor, so there is nothing here for an admin to see. RouteGuard redirects
    // any other role away before the iframe mounts; the sidebar link is gone too.
    [UserRole.Student],
    [FeatureAccess.AiTutorAccess]
);
