import {
    getClassMgmtData,
    getClassTitle,
    getProgram,
    getProgramData,
    getProgramTitle
} from '@/routeLoaders';
import { DeclareAuthenticatedRoutes } from './Routes';
import Programs from '@/Pages/ProgramManagement';
import { FeatureAccess, TitleHandler, UserRole } from '@/common';
import { AdminRoles } from '@/useAuth';
import ProgramOverviewDashboard from '@/Pages/ProgramOverviewDashboard';
import CreateProgramPage from '@/Pages/CreateProgram';
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

export const ProgramRoutes = DeclareAuthenticatedRoutes(
    [
        {
            path: 'programs-residents',
            // loader: ,
            element: <ResidentOverview />,
            handle: {
                title: 'Current Enrollments',
                path: ['programs-residents']
            }
        }
    ],
    [UserRole.Student],
    [FeatureAccess.ProgramAccess]
);

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
