import { PaginationMeta } from './server';

export interface OpenContentProvider {
    id: number;
    title: string;
    url: string;
    thumbnail_url: string | null;
    currently_enabled: boolean;
    description: string | null;
}

export interface Video {
    id: number;
    title: string;
    description: string;
    channel_title: string;
    external_id: string;
    visibility_status: boolean;
    thumbnail_url: string;
    open_content_provider_id: number;
    availability: 'available' | 'processing' | 'has_error';
    duration: number;
    created_at: string;
    updated_at: string;
    is_favorited: boolean;
    open_content_provider?: OpenContentProvider;
    video_download_attempts: VideoDownloadAttempt[];
    video_favorites: VideoFavorites[];
}

export interface VideoFavorites {
    user_id: number;
    video_id: number;
}

export interface VideoDownloadAttempt {
    id: number;
    video_id: number;
    error_message: string;
}

export const MAX_DOWNLOAD_ATTEMPTS = 5;

export interface Library {
    description: string | null;
    external_id: string | null;
    id: number;
    thumbnail_url: string | null;
    language: string | null;
    title: string;
    open_content_provider_id: number;
    updated_at: string;
    url: string;
    visibility_status: boolean;
    open_content_provider: OpenContentProvider;
    is_favorited: boolean;
}

export interface HelpfulLink {
    id: number;
    title: string;
    description: string;
    url: string;
    visibility_status: boolean;
    thumbnail_url: string;
    open_content_provider_id: number;
    facility_id: number;
    is_favorited: boolean;
}

export interface HelpfulLinkAndSort {
    helpful_links: HelpfulLink[];
    sort_order: string;
    meta: PaginationMeta;
}

export interface OpenContentItem {
    title: string;
    url: string;
    external_id: string | null;
    thumbnail_url: string | null;
    description?: string;
    visibility_status?: boolean;
    open_content_provider_id: number;
    content_id: number;
    content_type: string;
    provider_name?: string;
    channel_title?: string;
}

export interface OpenContentResponse extends OpenContentItem {
    is_featured: boolean;
    total_hours: number;
    total_minutes: number;
}

export interface SearchResult {
    book: string;
    title: string;
    thumbnail_url: string;
    link: string;
    description: string;
    total_results: string;
    start_index: string;
    items_per_page: string;
    items?: SearchResultItem[];
}

export interface SearchResultItem extends OpenContentItem {
    page_title?: string;
}

export enum OpenContentTabs {
    KIWIX = 'Libraries',
    VIDEOS = 'Videos',
    LINKS = 'Helpful Links',
    FAVORITES = 'Favorites'
}

export enum VideoAdminVisibility {
    'All Videos' = 'all',
    'Visible' = 'visible',
    'Hidden' = 'hidden'
}

export enum LibraryAdminVisibility {
    'All Libraries' = 'all',
    'Visible' = 'visible',
    'Hidden' = 'hidden',
    'Featured' = 'featured'
}

export enum FilterOpenContent {
    'Title (A to Z)' = '&order_by=title&order=ASC',
    'Title (Z to A)' = '&order_by=title&order=DESC',
    'Date Added (Newest First)' = '&order_by=created_at&order=DESC',
    'Date Added  (Oldest First)' = '&order_by=created_at&order=ASC'
}
