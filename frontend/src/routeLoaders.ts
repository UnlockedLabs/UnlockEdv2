import { json, LoaderFunction } from 'react-router-dom';
import {
    Facility,
    OpenContentItem,
    ServerResponse,
    HelpfulLinkAndSort,
    Library,
    UserCoursesInfo,
    ActivityMapData
} from './common';
import API from './api/api';
import { fetchUser } from './useAuth';

export const getStudentLevel1Data: LoaderFunction = async () => {
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

    return json({
        helpfulLinks: helpfulLinks,
        topUserContent: topUserOpenContent,
        topFacilityContent: topFacilityOpenContent,
        favorites: favoriteOpenContent
    });
};

export const getAdminLevel1Data: LoaderFunction = async () => {
    const [featuredResp] = await Promise.all([
        API.get(`libraries?visibility=featured`)
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
        week_activity: activity.activities
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
