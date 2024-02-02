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
