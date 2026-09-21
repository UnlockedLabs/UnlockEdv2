import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import AiTutor from '@/pages/AiTutor';
import type { RouteObject } from 'react-router-dom';

export const TutorRoutes: RouteObject = declareAuthenticatedRoutes(
    [{ path: 'ai-tutor', element: <AiTutor />, handle: { title: 'AI Tutor' } }],
    // All roles. ID-868's resident-only narrowing is superseded: ai_tutor is now
    // a container for two capabilities (hiset_tutor, curriculum_builder), and an
    // admin needs somewhere to turn them on for their facility. AiTutor.tsx
    // branches — residents get the tutor itself, admins get the settings and the
    // curriculum builder. The gate stays the single parent flag; the page decides
    // what to show for each combination of the two inner ones.
    //
    // This does not reopen the tutor's own /teacher tree: that stays 404 by rule
    // (ADMIN_VIEW_IN_MVP in the tutor repo), not by admins being unable to reach
    // the iframe.
    AllRoles,
    [FeatureAccess.AiTutorAccess]
);
