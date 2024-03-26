export enum UserRole {
    Admin = "admin",
    Student = "student",
}

export interface User {
    id: number;
    name_first: string;
    name_last: string;
    username: string;
    role: string;
    email: string;
    [key: string]: any;
}

export interface Category {
    id: number;
    name: string;
    links: Array<CategoryLink>;
    rank: number;
}

export interface CategoryLink {
    [linkName: string]: string;
}

export interface Activity {
    browser_name: string;
    clicked_url: string;
    created_at: string;
    device: string;
    id: number;
    platform: string;
    updated_at: Date;
    user_id: number;
    user_name_first: string;
    user_name_last: string;
}

export interface ProviderPlatform {
    access_key: string;
    account_id: string;
    base_url: string;
    description: string;
    icon_url: string;
    id: number;
    name: string;
    state: ProviderPlatformState;
    type: ProviderPlatformType;
    [key: string | ProviderPlatformState | ProviderPlatformType]: any;
}

export enum ProviderPlatformState {
    ENABLED = "enabled",
    DISABLED = "disabled",
    ARCHIVED = "archived",
}

export enum ProviderPlatformType {
    CANVAS_CLOUD = "canvas_cloud",
    CANVAS_OSS = "canvas_oss",
}
