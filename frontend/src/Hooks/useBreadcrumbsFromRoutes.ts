import { useMatches } from 'react-router-dom';
import { BreadcrumbItem } from '@/Components/Breadcrumb';

interface RouteData {
    breadcrumbs?: BreadcrumbItem[];
}

export function useBreadcrumbsFromRoutes(): BreadcrumbItem[] {
    const matches = useMatches();

    const breadcrumbs: BreadcrumbItem[] = [];

    for (const match of matches) {
        const data = match.data as RouteData | undefined;
        if (data?.breadcrumbs) {
            breadcrumbs.push(...data.breadcrumbs);
        }
    }

    return breadcrumbs;
}
