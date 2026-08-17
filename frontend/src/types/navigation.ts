import { Room } from './facility';
import { Cohort } from './program';
import { BreadcrumbItem } from './ui';

export interface RouteLabel {
    title?: string;
    path: string[];
}

export interface TitleHandler {
    title: string;
    path?: string[];
}

export interface DynamicTitleHandler<T> {
    title: (data: T) => string;
    path?: string[];
}

export type RouteTitleHandler<T> = TitleHandler | DynamicTitleHandler<T>;

export interface ClassLoaderData extends TitleHandler {
    class?: Cohort;
    redirect?: string;
    rooms?: Room[];
    breadcrumbs?: BreadcrumbItem[];
}
