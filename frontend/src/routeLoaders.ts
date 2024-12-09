import { json, LoaderFunction } from 'react-router-dom';
import {
    OpenContentFavorite,
    Facility,
    OpenContentItem,
    OpenContentProvider,
    ServerResponse,
    HelpfulLink,
    HelpfulLinkAndSort
} from './common';
import API from './api/api';
import { fetchUser } from './useAuth';

export const getOpenContentDashboardData: LoaderFunction = async () => {
    const user = await fetchUser();
    if (!user) return;
    const [resourcesResp, userContentResp, facilityContentResp, favoritesResp] =
        await Promise.all([
            API.get(`helpful-links?visibility=true`),
            API.get(`open-content/activity/${user.id}`),
            API.get(`open-content/activity`),
            API.get(`open-content/favorites`)
        ]);

    const links = resourcesResp.data as HelpfulLinkAndSort;
    console.log('resourcesResp', resourcesResp.data as HelpfulLinkAndSort);
    const helpfulLinks = resourcesResp.success ? links.helpful_links : [];
    const topUserOpenContent = userContentResp.success
        ? (userContentResp.data as OpenContentItem[])
        : [];
    const topFacilityOpenContent = facilityContentResp.success
        ? (facilityContentResp.data as OpenContentItem[])
        : [];
    const favoriteOpenContent = favoritesResp.success
        ? (favoritesResp.data as OpenContentFavorite[])
        : [];

    return json({
        helpfulLinks: helpfulLinks,
        topUserContent: topUserOpenContent,
        topFacilityContent: topFacilityOpenContent,
        favorites: favoriteOpenContent
    });
};

export const getRightSidebarData: LoaderFunction = async () => {
    const [resourcesResp, openContentResp] = await Promise.all([
        API.get(`helpful-links`),
        API.get(`open-content`)
    ]);

    const resourcesData = resourcesResp.success
        ? (resourcesResp.data as HelpfulLink[])
        : [];
    const openContentData = openContentResp.success
        ? (openContentResp.data as OpenContentProvider[])
        : [];

    return json({ resources: resourcesData, providers: openContentData });
};

export const getFacilities: LoaderFunction = async () => {
    const response: ServerResponse<Facility[]> =
        await API.get<Facility[]>(`facilities`);
    if (response.success) {
        return json<Facility[]>(response.data as Facility[]);
    }
    return json<null>(null);
};
