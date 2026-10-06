import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
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

export const ProgramRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'resident-programs',
            lazy: () =>
                import('@/features/programs/resident').then((m) => ({
                    Component: m.ResidentOverview
                })),
            loader: getProgramData,
            handle: {
                title: 'My Programs',
                path: ['resident-programs']
            }
        },
        {
            path: 'resident-schedule',
            lazy: () =>
                import('@/features/programs/resident').then((m) => ({
                    Component: m.ResidentSchedule
                })),
            handle: {
                title: 'Schedule',
                path: ['resident-schedule']
            }
        }
    ],
    [UserRole.Student],
    // ResidentProgramsAccess is the resident-facing visibility sub-feature; when an
    // admin turns it off (or program tracking itself is off) the route falls through
    // to the auth callback rather than rendering.
    [FeatureAccess.ProgramAccess, FeatureAccess.ResidentProgramsAccess]
);

export const DeptAdminProgramRoutes = declareAuthenticatedRoutes(
    [
        {
            path: 'programs/detail/:program_id?',
            loader: getProgramData,
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ProgramManagementForm
                })),
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
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ClassesPage
                })),
            handle: {
                title: 'Classes',
                path: ['classes']
            }
        },
        {
            path: 'programs',
            id: 'programs-facilities',
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ProgramsPage
                })),
            loader: getFilterDropdowns,
            handle: {
                title: 'Programs',
                path: ['programs']
            }
        },
        {
            path: 'programs/:program_id',
            loader: getProgramData,
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ProgramOverviewDashboard
                })),
            handle: { title: 'Program Details' }
        },
        {
            path: 'programs/:id/classes/:class_id?',
            loader: getProgramTitle,
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ClassManagementForm
                })),
            handle: {
                title: (data: TitleHandler) => data.title
            }
        },
        {
            path: 'program-classes/:class_id/detail',
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ClassDetailPage
                })),
            handle: {
                title: 'Class Details',
                path: ['classes']
            }
        },
        {
            path: 'program-classes',
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.ProgramClassManagement
                })),
            handle: { title: 'Class Management' },
            children: [
                {
                    path: ':class_id/enrollments',
                    loader: getClassTitle,
                    lazy: () =>
                        import('@/features/programs/admin').then((m) => ({
                            Component: m.ClassEnrollmentDetails
                        })),
                    errorElement: <Error />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                },
                {
                    path: ':class_id/attendance',
                    loader: getClassTitle,
                    lazy: () =>
                        import('@/features/programs/admin').then((m) => ({
                            Component: m.ClassEvents
                        })),
                    errorElement: <Error />,
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                },
                {
                    path: ':class_id/schedule',
                    loader: getClassTitle,
                    // Schedule.tsx isn't owned by programs — app-routes.tsx also
                    // renders it eagerly for the core /schedule admin route, so it
                    // stays out of the programs barrel until that ownership question
                    // is settled.
                    lazy: () =>
                        import('@/pages/Schedule').then((m) => ({
                            Component: m.default
                        })),
                    handle: {
                        title: (data: TitleHandler) => data.title
                    }
                }
            ]
        },
        {
            path: 'program-classes/:class_id/enrollments/add',
            loader: getProgramTitle,
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.AddClassEnrollments
                })),
            handle: { title: 'Add Resident' }
        },
        {
            path: 'program-classes/:class_id/events/:event_id/attendance/:date',
            loader: getClassTitle,
            lazy: () =>
                import('@/features/programs/admin').then((m) => ({
                    Component: m.EventAttendance
                })),
            handle: { title: 'Take Attendance' }
        }
    ],
    AdminRoles,
    [FeatureAccess.ProgramAccess]
);
