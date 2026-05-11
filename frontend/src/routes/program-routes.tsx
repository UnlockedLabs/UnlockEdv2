import { declareAuthenticatedRoutes } from '@/auth/RouteGuard';
import { AdminRoles } from '@/auth/useAuth';
import { FeatureAccess, TitleHandler } from '@/types';
import { UserRole } from '@/types/user';
import {
    getClassTitle,
    getFilterDropdowns,
    getProgramData,
    getProgramTitle
} from '@/loaders/routeLoaders';
import Error from '@/pages/Error';
import ResidentOverview from '@/pages/learning/ResidentOverview';
import ClassesPage from '@/pages/ClassesPage';
import ProgramsPage from '@/pages/ProgramsPage';
import ProgramManagementForm from '@/pages/programs/ProgramManagementForm';
import ProgramOverviewDashboard from '@/pages/programs/ProgramOverviewDashboard';
import ClassManagementForm from '@/pages/programs/ClassManagementForm';
import ProgramClassManagement from '@/pages/programs/ProgramClassManagement';
import ClassDetailPage from '@/pages/class-detail';
import ClassEnrollmentDetails from '@/pages/programs/ClassEnrollmentDetails';
import ClassEvents from '@/pages/programs/ClassEvents';
import AddClassEnrollments from '@/pages/programs/AddClassEnrollments';
import EventAttendance from '@/pages/event-attendance';
import Schedule from '@/pages/Schedule';

export const ProgramRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'resident-programs',
            element: <ResidentOverview />,
            loader: getProgramData,
            handle: {
                title: 'My Programs',
                path: ['resident-programs']
            }
        }
    ],
    [UserRole.Student],
    [FeatureAccess.ProgramAccess]
);

export const DeptAdminProgramRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'programs/detail/:program_id?',
            loader: getProgramData,
            element: <ProgramManagementForm />,
            handle: {
                title: 'Program Details',
                path: ['programs', 'detail']
            }
        }
    ],
    [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    [FeatureAccess.ProgramAccess]
);

export const AdminProgramRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'classes',
            element: <ClassesPage />,
            handle: {
                title: 'Classes',
                path: ['classes']
            }
        },
        {
            path: 'programs',
            id: 'programs-facilities',
            element: <ProgramsPage />,
            loader: getFilterDropdowns,
            handle: {
                title: 'Programs',
                path: ['programs']
            }
        },
        {
            path: 'programs/:program_id',
            loader: getProgramData,
            element: <ProgramOverviewDashboard />,
            handle: { title: 'Program Details' }
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
            path: 'program-classes/:class_id/detail',
            element: <ClassDetailPage />,
            handle: {
                title: 'Class Details',
                path: ['classes']
            }
        },
        {
            path: 'program-classes',
            element: <ProgramClassManagement />,
            handle: { title: 'Class Management' },
            children: [
                {
                    path: ':class_id/enrollments',
                    loader: getClassTitle,
                    element: <ClassEnrollmentDetails />,
                    errorElement: <Error />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                },
                {
                    path: ':class_id/attendance',
                    loader: getClassTitle,
                    element: <ClassEvents />,
                    errorElement: <Error />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                },
                {
                    path: ':class_id/schedule',
                    loader: getClassTitle,
                    element: <Schedule />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                }
            ]
        },
        {
            path: 'program-classes/:class_id/enrollments/add',
            loader: getProgramTitle,
            element: <AddClassEnrollments />,
            handle: { title: 'Add Resident' }
        },
        {
            path: 'program-classes/:class_id/events/:event_id/attendance/:date',
            loader: getClassTitle,
            element: <EventAttendance />,
            handle: {
                title: (data: TitleHandler) =>
                    `${data.title}: Event Attendance`
            }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
