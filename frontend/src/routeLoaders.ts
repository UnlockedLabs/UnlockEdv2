import { json, LoaderFunction, redirect } from 'react-router-dom';
import {
    OpenContentItem,
    ServerResponse,
    HelpfulLinkAndSort,
    Library,
    UserCoursesInfo,
    ActivityMapData,
    UserRole,
    Option,
    ProviderPlatform,
    Program,
    RouteTitleHandler,
    Class,
    ServerResponseOne,
    ClassLoaderData,
    ProgramOverview,
    SelectedClassStatus,
    Room,
    BreadcrumbItem
} from './common';
import API from './api/api';
import { fetchUser } from './useAuth';

function buildClassBreadcrumbs(
    cls: Class,
    currentTab: string
): BreadcrumbItem[] {
    return [
        { label: 'Programs', href: '/programs' },
        {
            label: cls.program.name,
            href: `/programs/${cls.program.id}`
        },
        {
            label: cls.name,
            href: `/program-classes/${cls.id}/dashboard`
        },
        { label: currentTab }
    ];
}

export const getStudentLevel1Data: LoaderFunction = async ({ request }) => {
    const user = await fetchUser();
    if (!user) return;
    const [resourcesResp, userContentResp, facilityContentResp, favoritesResp] =
        await Promise.all([
            API.get(`helpful-links?visibility=true&per_page=5`),
            API.get(`open-content/activity/${user.id}`),
            API.get(`open-content/activity`),
            API.get(`open-content/favorites`)
        ]);

    const links = resourcesResp.data as HelpfulLinkAndSort;
    const helpfulLinks = resourcesResp.success ? links.helpful_links : [];
    const topUserOpenContent = userContentResp.success
        ? (userContentResp.data as OpenContentItem[])
        : [];
    const topFacilityOpenContent = facilityContentResp.success
        ? (facilityContentResp.data as OpenContentItem[])
        : [];
    const favoriteOpenContent = favoritesResp.success
        ? (favoritesResp.data as OpenContentItem[])
        : [];
    const libraryOptions = getLibraryOptionsHelper({ request });
    return json({
        helpfulLinks: helpfulLinks,
        topUserContent: topUserOpenContent,
        topFacilityContent: topFacilityOpenContent,
        favorites: favoriteOpenContent,
        libraryOptions: libraryOptions
    });
};

export const getAdminLevel1Data: LoaderFunction = async () => {
    const [featuredResp] = await Promise.all([
        API.get(`libraries?visibility=featured&order_by=created_at`)
    ]);

    const featured = featuredResp.success
        ? (featuredResp.data as Library[])
        : [];

    return json({
        featured: featured
    });
};

export const getStudentLayer2Data: LoaderFunction = async () => {
    const user = await fetchUser();
    if (!user) return;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    const [coursesResp, activityResp] = await Promise.all([
        API.get(`users/${user.id}/courses?order=desc&order_by=recent_activity`),
        API.get(
            `users/${user.id}/daily-activity?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
        )
    ]);

    const courses = coursesResp.data as UserCoursesInfo;
    const activity = activityResp.data as { activities: ActivityMapData[] };

    return json({
        courses: courses.courses,
        week_activity: activity.activities || []
    });
};

export const getLibraryLayoutData: LoaderFunction = async ({
    request
}: {
    request: Request;
}) => {
    const [tagsResp] = await Promise.all([API.get(`tags`)]);
    const categories = tagsResp.data as Option[];
    const libraryOptions = await getLibraryOptionsHelper({ request });
    return json({ categories: categories, libraryOptions: libraryOptions });
};

const getLibraryOptionsHelper = async ({ request }: { request: Request }) => {
    const user = await fetchUser();
    if (!user) return;
    const visibilityParam =
        user.Role != UserRole.Student &&
        (request.url.includes('management') || request.url.includes('viewer'))
            ? '&visibility=all'
            : '&visibility=visible';
    const libraryResp = await API.get(
        `libraries?all=true&order_by=title&order=asc${visibilityParam}`
    );
    const libraryOptions = libraryResp.success
        ? (libraryResp.data as Library[]).map(
              (library) =>
                  ({
                      key: library.id,
                      value: library.title
                  }) as Option
          )
        : [];
    return libraryOptions;
};

export const getProgramData: LoaderFunction = async ({ params }) => {
    const { program_id } = params;
    const [tagsResp] = await Promise.all([API.get(`tags`)]);
    const categories = tagsResp.data as Option[];
    let program: ProgramOverview | undefined;
    let redirect: string | undefined;
    if (program_id) {
        const resp = await API.get(`programs/${program_id}`);
        if (resp.success) {
            program = resp.data as ProgramOverview;
        } else {
            redirectOnError(resp);
        }
    }
    return json({
        categories: categories,
        program: program,
        redirect: redirect
    });
};

export const getProviderPlatforms: LoaderFunction = async () => {
    const response: ServerResponse<ProviderPlatform> =
        await API.get<ProviderPlatform>(`provider-platforms?only=oidc_enabled`);
    if (response.success) {
        return json({ providerPlatforms: response.data as ProviderPlatform[] });
    }
    return json({ providerPlatforms: [] });
};

export const getProgramTitle: LoaderFunction = async ({
    params,
    request
}): Promise<ClassLoaderData | Response> => {
    const { id, class_id } = params;
    let cls: Class | undefined;
    let programName = 'Class Details';
    let rooms: Room[] = [];
    let breadcrumbs: BreadcrumbItem[] | undefined;

    const roomsResp = await API.get('rooms');
    if (roomsResp.success) {
        rooms = roomsResp.data as Room[];
    }
    if (id) {
        const resp = await API.get(`programs/${id}`);
        if (resp.success) {
            programName = 'Program: ' + (resp.data as Program).name;
        } else {
            return redirectOnError(resp);
        }
    }
    if (class_id && class_id != 'new') {
        const classResp = (await API.get(
            `program-classes/${class_id}`
        )) as ServerResponseOne<Class>;
        if (classResp.success) {
            cls = classResp.data;
        } else {
            return redirectOnError(classResp);
        }
    }

    const url = new URL(request.url);
    const isAddEnrollment = url.pathname.includes('enrollments/add') && cls;

    if (isAddEnrollment && cls) {
        breadcrumbs = [
            { label: 'Programs', href: '/programs' },
            { label: cls.program.name, href: `/programs/${cls.program.id}` },
            { label: cls.name, href: `/program-classes/${cls.id}/dashboard` },
            {
                label: 'Enrollment',
                href: `/program-classes/${cls.id}/enrollments`
            },
            { label: 'Add Resident' }
        ];
    }

    return {
        title: programName,
        class: cls,
        rooms: rooms,
        breadcrumbs
    };
};

const tabNameMap: Record<string, string> = {
    enrollments: 'Enrollment',
    attendance: 'Attendance',
    schedule: 'Schedule'
};

export const getClassTitle: LoaderFunction = async ({
    params,
    request
}): Promise<ClassLoaderData | Response> => {
    const { class_id, date } = params;
    const classResp = (await API.get(
        `program-classes/${class_id}`
    )) as ServerResponseOne<Class>;
    if (classResp.success) {
        const cls = classResp.data;
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const isEventAttendance =
            pathParts.includes('events') && pathParts.includes('attendance');

        let breadcrumbs: BreadcrumbItem[];
        if (isEventAttendance && date) {
            breadcrumbs = [
                { label: 'Programs', href: '/programs' },
                {
                    label: cls.program.name,
                    href: `/programs/${cls.program.id}`
                },
                {
                    label: cls.name,
                    href: `/program-classes/${cls.id}/dashboard`
                },
                {
                    label: 'Attendance',
                    href: `/program-classes/${cls.id}/attendance`
                },
                { label: `Attendance: ${date}` }
            ];
        } else {
            const tabSegment = pathParts[pathParts.length - 1];
            const tabName = tabNameMap[tabSegment] ?? tabSegment;
            breadcrumbs = buildClassBreadcrumbs(cls, tabName);
        }

        return {
            title: cls.name,
            class: cls,
            breadcrumbs
        };
    } else {
        return redirectOnError(classResp);
    }
};

export const getClassMgmtData: LoaderFunction = async ({
    params
}): Promise<ClassLoaderData | Response> => {
    const { class_id } = params;
    let cls: Class | undefined;
    let attendanceRate: number | undefined;
    let missingAttendance: number | undefined;
    let className = 'Class Management';
    const classResp = (await API.get(
        `program-classes/${class_id}`
    )) as ServerResponseOne<Class>;
    if (classResp.success) {
        cls = classResp.data;
        className = cls.name;
        if (classResp.data.status === SelectedClassStatus.Scheduled) {
            attendanceRate = 0;
            missingAttendance = 0;
        } else {
            const resp2 = (await API.get(
                `program-classes/${class_id}/attendance-rate`
            )) as ServerResponseOne<{ attendance_rate: number }>;
            attendanceRate = resp2.success ? resp2.data.attendance_rate : 0;
            const resp3 = (await API.get(
                `program-classes/${class_id}/missing-attendance`
            )) as ServerResponseOne<number>;
            missingAttendance = resp3.success ? resp3.data : 0;
        }
    } else {
        return redirectOnError(classResp);
    }
    return {
        title: className,
        class: cls,
        attendance_rate: attendanceRate,
        missing_attendance: missingAttendance,
        breadcrumbs: cls ? buildClassBreadcrumbs(cls, 'Dashboard') : undefined
    };
};

export const getProgram: LoaderFunction = async ({ params }) => {
    const resp = (await API.get(`programs/${params.id}`)) as ServerResponseOne<
        ProgramOverview | Response
    >;
    if (!resp.success) {
        return redirectOnError(resp);
    }
    return json(resp.data);
};

export function resolveTitle<T>(
    handle: RouteTitleHandler<T> | undefined,
    data: T
): string {
    if (!handle) return '';
    return typeof handle.title === 'function'
        ? handle.title(data)
        : handle.title;
}

function redirectOnError<T>(resp: ServerResponse<T>) {
    if (resp.status === 401 || resp.status === 403) {
        return redirect('/unauthorized');
    }
    if (resp.status === 404) {
        return redirect('/404');
    }
    return redirect('/error');
}

export const getFilterDropdowns: LoaderFunction = async () => {
    const resp = await API.get(`programs/filters`);
    return json(resp.data);
};
