export enum UserRole {
    Admin = 'admin',
    Student = 'student'
}

export const BROWSER_URL = '/self-service/login/browser';

export const DEFAULT_ADMIN_ID = 1;
export interface User {
    id: number;
    name_first: string;
    name_last: string;
    username: string;
    role: string;
    email: string;
    password_reset?: boolean;
    [key: string]: any;
}

export interface UserWithMappings {
    User: User;
    logins: Array<ProviderMapping>;
}

export interface AuthResponse {
    redirect_to: string;
}
export interface NewUserResponse {
    user: User;
    temp_password: string;
}

export interface ResetPasswordResponse {
    temp_password: string;
    message: string;
}

export interface Facility {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface ProviderUser {
    username: string;
    name_last: string;
    name_first: string;
    email: string;
    external_user_id: string;
    external_username: string;
}

export interface UserImports {
    username: string;
    temp_password: string;
    error?: string;
}

export interface ProviderMapping {
    id: number;
    provider_platform_id: number;
    user_id: number;
    external_user_id: string;
    external_login_id: string;
    external_username: string;
    created_at: Date;
    updated_at: Date;
}

export interface PaginationMeta {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export interface ServerResponse<T> {
    [key: string]: any;
    success: boolean;
    message: string;
    data: Array<T> | T | null;
    pagination?: PaginationMeta;
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

export interface OidcClient {
    client_id: string;
    client_secret: string;
    scope: string;
    auth_url: string;
    token_url: string;
}

export interface Activity {
    browser_name: string;
    clicked_url: string;
    created_at: string;
    device: string;
    id: number;
    platform: string;
    updated_at: Date;
    user_name_first: string;
    user_name_last: string;
}
export interface Program {
    id: number;
    provider_platform_id: number;
    name: string;
    description: string;
    external_id: string;
    thumbnail_url: string;
    is_public: boolean;
    external_url: string;
    created_at: Date;
    updated_at: Date;
}
export interface Outcome {
    id: number;
    type: string;
    program_id: number;
    user_id: number;
    value: string;
}
export interface UserProgramsInfo {
    num_completed: number;
    total_time: number;
    programs: UserPrograms[];
}
export interface UserPrograms {
    id: number;
    thumbnail_url: string;
    program_name: string;
    provider_platform_name: string;
    external_url: string;
    course_progress: number;
    is_favorited: boolean;
    total_time: number;
    grade?: string;
}

export interface CourseCatalogue {
    key: [number, string, boolean];
    program_id: number;
    thumbnail_url: string;
    program_name: string;
    provider_name: string;
    external_url: string;
    program_type: string;
    description: string;
    is_favorited: boolean;
    outcome_types: string;
}

export interface Milestone {
    id: number;
    program_id: number;
    type: string;
    external_url: string;
    description: string;
    external_id: Date;
    created_at: Date;
    updated_at: Date;
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
    oidc_id: number;
    [key: string | ProviderPlatformState | ProviderPlatformType]: any;
}

export enum ProviderPlatformState {
    ENABLED = 'enabled',
    DISABLED = 'disabled',
    ARCHIVED = 'archived'
}

export enum ProviderPlatformType {
    CANVAS_CLOUD = 'canvas_cloud',
    CANVAS_OSS = 'canvas_oss',
    KOLIBRI = 'kolibri'
}

export interface AdminDashboardJoin {
    monthly_activity: RecentActivity[];
    weekly_active_users: number;
    avg_daily_activity: number;
    total_weekly_activity: number;
    program_milestones: ProgramMilestones[];
    top_program_activity: ProgramActivity[];
    facility_name: string;
}

export interface StudentDashboardJoin {
    enrollments: CurrentEnrollment[];
    recent_programs: RecentProgram[];
    top_programs: string[];
    week_activity: RecentActivity[];
}

export interface CurrentEnrollment {
    alt_name: string;
    name: string;
    provider_platform_name: string;
    external_url: string;
    total_activity_time: number;
}
export interface RecentProgram {
    program_name: string;
    course_progress: string;
    alt_name: string;
    thumbnail_url: string;
    provider_platform_name: string;
    external_url: string;
}
export interface ProgramMilestones {
    name: string;
    milestones: number;
}

export interface ProgramActivity {
    program_name: string;
    hours_engaged: number;
}

export interface RecentActivity {
    date: string;
    delta: number;
}

export interface Link {
    [name: string]: string;
}

export interface Resource {
    name: string;
    links: Array<Link>;
    rank: number;
}
