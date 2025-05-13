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
    ProgramOverview
} from './common';
import API from './api/api';
import { fetchUser } from './useAuth';

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

export const getProgramData: LoaderFunction = async () => {
    const tagsResp = await API.get(`tags`);
    const categories = tagsResp.data as Option[];
    return json({ categories: categories });
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
    params
}): Promise<ClassLoaderData> => {
    const { id, class_id } = params;
    let cls: Class | undefined;
    let programName = 'Class Details';
    if (id) {
        const resp = await API.get(`programs/${id}`);
        if (resp.success) {
            programName = 'Program: ' + (resp.data as Program).name;
        } else {
            return { title: programName, redirect: '/404' };
        }
    }
    // one of the routes this is assigned to, uses either /:program_id || /new
    // so if the program_id is provided and it's not new, then we make the request and
    // return a redirect if the class is not found
    if (class_id && class_id != 'new') {
        const classResp = (await API.get(
            `program-classes/${class_id}`
        )) as ServerResponseOne<Class>;
        if (classResp.success) {
            cls = classResp.data;
        } else {
            return { title: programName, redirect: '/404' };
        }
    }
    return {
        title: programName,
        class: cls
    };
};

export const getClassTitle: LoaderFunction = async ({
    params
}): Promise<ClassLoaderData> => {
    const { class_id } = params;
    let cls: Class | undefined;
    let className = 'Class Management';
    const classResp = (await API.get(
        `program-classes/${class_id}`
    )) as ServerResponseOne<Class>;
    if (classResp.success) {
        cls = classResp.data;
        className = cls.name;
    } else {
        return { title: className, redirect: '/404' };
    }
    return {
        title: className,
        class: cls
    };
};

export const getClassMgmtData: LoaderFunction = async ({
    params
}): Promise<ClassLoaderData> => {
    const { class_id } = params;
    let cls: Class | undefined;
    let attendanceRate: number | undefined;
    let className = 'Class Management';
    const classResp = (await API.get(
        `program-classes/${class_id}`
    )) as ServerResponseOne<Class>;
    if (classResp.success) {
        cls = classResp.data;
        className = cls.name;
        if (cls.events && cls.events.length > 0) {
            const resp2 = (await API.get(
                `program-classes/${class_id}/events/${cls.events[0].id}/attendance-rate`
            )) as ServerResponseOne<{ attendance_rate: number }>;
            attendanceRate = resp2.success ? resp2.data.attendance_rate : 0;
        }
    } else {
        return { title: className, redirect: '/404' };
    }
    return {
        title: className,
        attendance_rate: attendanceRate
    };
};

export const getProgram: LoaderFunction = async ({ params }) => {
    const resp = (await API.get(
        `programs/${params.id}`
    )) as ServerResponseOne<ProgramOverview>;
    if (!resp.success) {
        return redirect('/404');
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
