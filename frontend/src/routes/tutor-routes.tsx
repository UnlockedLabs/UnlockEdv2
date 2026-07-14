import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import AiTutor from '@/pages/AiTutor';
import type { RouteObject } from 'react-router-dom';

export const TutorRoutes: RouteObject = declareAuthenticatedRoutes(
    [{ path: 'ai-tutor', element: <AiTutor />, handle: { title: 'AI Tutor' } }],
    AllRoles,
    [FeatureAccess.AiTutorAccess]
);
