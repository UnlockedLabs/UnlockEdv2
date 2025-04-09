import { getProgram, getProgramData, getProgramTitle } from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess, TitleHandler } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';
import ClassManagementForm from '@/Pages/ClassManagementForm';
import AddClassEnrollments from '@/Pages/AddClassEnrollments';
import ClassEnrollmentDetails from '@/Pages/ClassEnrollmentDetails';
import ProgramClassEnrollment from '@/Pages/ProgramClassEnrollment';
import ClassEvents from '@/Pages/ClassEvents';
import EventAttendance from '@/Pages/EventAttendance';

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
            loader: getProgram,
            element: <ProgramOverviewDashboard />,
            handle: { title: 'Program Overview Dashboard' }
        },
        {
            path: 'programs/:id/classes/:class_id?',
            loader: getProgramTitle,
            element: <ClassManagementForm />,
            handle: {
                title: (data: TitleHandler) => data.title
            }
        },
        {
            path: 'programs/:id/classes/:class_id/enrollments',
            loader: getProgramTitle,
            element: <ClassEnrollmentDetails />,
            handle: {
                title: 'Class Enrollments'
            }
        },
        {
            path: 'programs/:id/classes/:class_id/enrollments/add',
            loader: getProgramTitle,
            element: <AddClassEnrollments />,
            handle: { title: 'Add Resident' }
        },
        {
            path: 'programs/:id/class/:class_id/events',
            element: <ClassEvents />,
            handle: { title: 'Class Events' }
        },
        {
            path: 'programs/:id/class/:class_id/events/:event_id/attendance/:date',
            element: <EventAttendance />,
            handle: { title: 'Event Attendance' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
