import {
    getClassMgmtData,
    getClassTitle,
    getProgramData,
    getProgramTitle
} from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess, TitleHandler, UserRole } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import ProgramManagementForm from '@/Pages/ProgramManagementForm';
import ClassManagementForm from '@/Pages/ClassManagementForm';
import AddClassEnrollments from '@/Pages/AddClassEnrollments';
import ClassEnrollmentDetails from '@/Pages/ClassEnrollmentDetails';
import ClassEvents from '@/Pages/ClassEvents';
import EventAttendance from '@/Pages/EventAttendance';
import ProgramClassManagement from '@/Pages/ProgramClassManagement';
import ClassLayout from '@/Components/ClassLayout';
import Error from '@/Pages/Error';
import { Navigate } from 'react-router-dom';
import ResidentOverview from '@/Pages/ResidentOverview';
import Schedule from '@/Pages/Schedule';

export const ProgramRoutes = DeclareAuthenticatedRoutes(
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

export const DeptAdminProgramRoutes = DeclareAuthenticatedRoutes(
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

export const AdminProgramRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'programs',
            id: 'programs-facilities',
            element: <Programs />,
            handle: {
                title: 'Programs Management',
                path: ['programs']
            }
        },
        {
            path: 'programs/:program_id',
            loader: getProgramData,
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
            path: 'program-classes',
            element: <ProgramClassManagement />,
            handle: {
                title: 'Class Management'
            },
            children: [
                {
                    path: ':class_id',
                    element: <Navigate to="./dashboard" replace /> //added this for redirecting user to dashboard
                },
                {
                    path: ':class_id/dashboard',
                    loader: getClassMgmtData,
                    element: <ClassLayout />,
                    errorElement: <Error />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                },
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
                title: (data: TitleHandler) => `${data.title}: Event Attendance`
            }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
