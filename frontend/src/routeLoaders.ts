import { json, LoaderFunction } from 'react-router-dom';
import {
    Facility,
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
    ClassLoaderData
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

export const getFacilities: LoaderFunction = async () => {
    const response: ServerResponse<Facility[]> =
        await API.get<Facility[]>(`facilities`);
    if (response.success) {
        return json<Facility[]>(response.data as Facility[]);
    }
    return json<null>(null);
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
        `libraries?all=true&order_by=title${visibilityParam}`
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
    const [tagsResp, facilitiesResp] = await Promise.all([
        API.get(`tags`),
        API.get<Facility[]>(`facilities`)
    ]);
    const categories = tagsResp.data as Option[];
    const facilities = facilitiesResp.data as Facility[];
    return json({ categories: categories, facilities: facilities });
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
        }
    }
    if (class_id) {
        const classResp = (await API.get(
            `program-classes/${class_id}`
        )) as ServerResponseOne<Class>;
        if (classResp.success) {
            cls = classResp.data;
        }
    }
    return {
        title: programName,
        class: cls
    };
};

export const getProgram: LoaderFunction = async ({ params }) => {
    const resp = (await API.get(
        `programs/${params.id}`
    )) as ServerResponseOne<Program>;
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
