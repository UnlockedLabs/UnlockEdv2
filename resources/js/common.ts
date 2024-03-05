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
