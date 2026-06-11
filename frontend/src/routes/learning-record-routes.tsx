import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import Error from '@/pages/Error';
import DigitalTranscriptHome from '@/pages/student/digital-transcript/DigitalTranscriptHome';
import DigitalTranscriptEntryPage from '@/pages/student/digital-transcript/DigitalTranscriptEntryPage';
import { redirect } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

export const LearningRecordRoutes: RouteObject = declareAuthenticatedRoutes(
    [
        {
            path: 'learning-record-funnel',
            element: <DigitalTranscriptHome />,
            errorElement: <Error />,
            handle: { title: 'Learning Record' }
        },
        {
            path: 'learning-record-funnel/entry',
            element: <DigitalTranscriptEntryPage />,
            errorElement: <Error />,
            handle: { title: 'Add your achievement' }
        },
        {
            path: 'learning-record-categories',
            element: <DigitalTranscriptHome />,
            errorElement: <Error />,
            handle: { title: 'Learning Record' }
        },
        {
            path: 'learning-record-categories/entry',
            element: <DigitalTranscriptEntryPage />,
            errorElement: <Error />,
            handle: { title: 'Add your achievement' }
        },
        {
            path: 'my-transcript-a',
            loader: () => redirect('/learning-record-funnel')
        },
        {
            path: 'my-transcript-a/entry',
            loader: () => redirect('/learning-record-funnel/entry')
        }
    ],
    AllRoles,
    [FeatureAccess.LearningRecordAccess]
);
