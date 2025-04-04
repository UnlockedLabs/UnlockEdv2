import { getProgramData, getProgramTitle } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess, TitleHandler } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';
import ClassManagementForm from '@/Pages/ClassManagementForm';
import ProgramClassEnrollment from '@/Pages/ProgramClassEnrollment';
import CurrentEnrollmentDetails from '@/Pages/CurrentClassEnrollments';

export const AdminProgramRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'programs',
            id: 'programs-facilities',
            loader: getProgramData,
            element: <Programs />,
            handle: {
                title: 'Programs Management',
                path: ['programs']
            }
        },
        {
            path: 'programs/detail',
            loader: getProgramData,
            element: <CreateProgramPage />,
            handle: {
                title: 'Program Details',
                path: ['programs', 'detail']
            }
        },

        {
            path: 'programs/:id',
            element: <ProgramOverviewDashboard />,
            handle: { title: 'Program Overview Dashboard' }
        },
        {
            path: 'programs/:id/class/:class_id?',
            loader: getProgramTitle,
            element: <ClassManagementForm />,
            handle: {
                title: (data: TitleHandler) => data.title
            }
        },
        {
            path: 'programs/:id/classes/:class_id/add',
            element: <ProgramClassEnrollment />,
            handle: { title: 'Add Resident' }
        },
        {
            path: 'programs/:id/classes/:class_id/enrollments',
            element: <CurrentEnrollmentDetails />,
            handle: {
                title: 'Class Enrollments'
            }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
