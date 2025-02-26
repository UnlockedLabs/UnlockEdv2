import { ReactNode } from 'react';

export enum UserRole {
    SystemAdmin = 'system_admin',
    DepartmentAdmin = 'department_admin',
    FacilityAdmin = 'facility_admin',
    Student = 'student'
}
export enum FeatureAccess {
    ProviderAccess = 'provider_platforms',
    OpenContentAccess = 'open_content',
    ProgramAccess = 'program_management'
}
export const INIT_KRATOS_LOGIN_FLOW = '/self-service/login/browser';
export interface User {
    id: number;
    name_first: string;
    name_last: string;
    username: string;
    role: UserRole;
    email: string;
    password_reset?: boolean;
    created_at: string;
    updated_at: string;
    facility_name?: string;
    feature_access: FeatureAccess[];
    [key: string]: number | string | boolean | undefined | FeatureAccess[];
}

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
export function getVideoErrorMessage(video: Video): string | undefined {
    return video.video_download_attempts.find(
        (attempt) => attempt.error_message !== ''
    )?.error_message;
}
export function videoIsAvailable(vid: Video): boolean {
    return vid.availability === 'available';
}

export interface OrySessionWhoami {
    active: boolean;
    authenticated_at: string;
    expires_at: string;
    id: string;
    identity: OryIdentity;
    issued_at: string;
    tokenized: string;
}

export interface OryIdentity {
    id: string;
    schema_id: string;
    schema_url: string;
    state: string;
    state_changed_at: string;
    traits?: OryTraits;
    updated_at: string;
}

export interface OryFlow {
    active: string;
    created_at: string;
    expires_at: string;
    id: string;
    issued_at: string;
    oauth2_login_challenge?: string;
    oauth2_login_request?: Oauth2LoginRequest;
    organization_id: string;
    refresh: boolean;
    request_url: string;
    requested_aal: string;
    return_to: string;
    session_token_exchange_code: string;
    // eslint-disable-next-line
    state: any;
    type: string;
    ui: OryUi;
    updated_at: string;
}

export interface Oauth2LoginRequest {
    challenge: string;
    client: Client;
    oidc_context: OidcContext;
    request_url: string;
    requested_access_token_audience: string[];
    requested_scope: string[];
    session_id: string;
    skip: boolean;
    subject: string;
}

export interface Client {
    access_token_strategy: string;
    allowed_cors_origins: string[];
    audience: string[];
    authorization_code_grant_access_token_lifespan: string;
    authorization_code_grant_id_token_lifespan: string;
    authorization_code_grant_refresh_token_lifespan: string;
    backchannel_logout_session_required: boolean;
    backchannel_logout_uri: string;
    client_credentials_grant_access_token_lifespan: string;
    client_id: string;
    client_name: string;
    client_secret: string;
    client_secret_expires_at: number;
    client_uri: string;
    contacts: string[];
    created_at: string;
    frontchannel_logout_session_required: boolean;
    frontchannel_logout_uri: string;
    grant_types: string[];
    implicit_grant_access_token_lifespan: string;
    implicit_grant_id_token_lifespan: string;
    // eslint-disable-next-line
    jwks: any;
    jwks_uri: string;
    jwt_bearer_grant_access_token_lifespan: string;
    logo_uri: string;
    // eslint-disable-next-line
    metadata: any;
    owner: string;
    policy_uri: string;
    post_logout_redirect_uris: string[];
    redirect_uris: string[];
    refresh_token_grant_access_token_lifespan: string;
    refresh_token_grant_id_token_lifespan: string;
    refresh_token_grant_refresh_token_lifespan: string;
    registration_access_token: string;
    registration_client_uri: string;
    request_object_signing_alg: string;
    request_uris: string[];
    response_types: string[];
    scope: string;
    sector_identifier_uri: string;
    skip_consent: boolean;
    skip_logout_consent: boolean;
    subject_type: string;
    token_endpoint_auth_method: string;
    token_endpoint_auth_signing_alg: string;
    tos_uri: string;
    updated_at: string;
    userinfo_signed_response_alg: string;
}

export enum ToastState {
    success = 'success',
    error = 'error',
    null = ''
}

export interface OidcContext {
    acr_values: string[];
    display: string;
    login_hint: string;
    ui_locales: string[];
}

export interface OryUi {
    action: string;
    messages: Message[];
    method: string;
    nodes: OryUiNode[];
}

export interface Message {
    id: number;
    text: string;
    type: string;
}

export interface OryUiNode {
    attributes: Attributes;
    group: string;
    messages: OryUiMessage[];
    type: string;
}

export interface Attributes {
    autocomplete: string;
    disabled: boolean;
    label: Label;
    maxlength: number;
    name: string;
    node_type: string;
    onclick: string;
    onclickTrigger: string;
    onload: string;
    onloadTrigger: string;
    pattern: string;
    required: boolean;
    type: string;
    value: string;
}
export interface RouteLabel {
    title?: string;
    path: string[];
}
export interface Label {
    id: number;
    text: string;
    type: string;
}
export interface OryUiMessage {
    id: number;
    text: string;
    type: string;
}

export interface AuthFlow {
    flow_id: string;
    challenge?: string;
    csrf_token: string;
    redirect_to?: string;
    identifier?: string;
}
export interface OryTraits {
    username: string;
    facility_id: number;
    role: UserRole;
    password_reset: boolean;
}

export interface AuthResponse {
    redirect_to: string;
    logout_url?: string;
    redirect_browser_to?: string;
}
export interface NewUserResponse {
    user: User;
    temp_password: string;
}

export interface ResetPasswordResponse {
    temp_password: string;
    message: string;
}

export interface ProviderResponse {
    platform?: ProviderPlatform;
    oauth2Url?: string;
}

export interface Facility {
    [key: string]: string | number;
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    timezone: string;
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

export interface PaginationMeta {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export interface ServerResponseBase {
    success: boolean;
    message: string;
}

export interface ServerResponseOne<T> extends ServerResponseBase {
    type: 'one';
    data: T;
}

export interface ServerResponseMany<T> extends ServerResponseBase {
    type: 'many';
    data: T[];
    meta: PaginationMeta;
}

export type ServerResponse<T> = ServerResponseOne<T> | ServerResponseMany<T>;

export interface LoginMetrics {
    data: {
        active_users: number;
        total_logins: number;
        logins_per_day: number;
        percent_active: number;
        percent_inactive: number;
        total_residents: number;
        total_admins: number;
        facility: string;
        new_residents_added: number;
        new_admins_added: number;
        peak_login_times: LoginActivity[];
    };
    last_cache: string;
}

export interface LoginActivity {
    time_interval: string;
    total_logins: number;
    facility_id: number;
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
export interface UserCoursesInfo {
    num_completed: number;
    num_in_progress: number;
    total_time: number;
    courses: UserCourses[];
}
export interface UserCourses {
    id: number;
    thumbnail_url: string;
    course_name: string;
    description: string;
    provider_platform_name: string;
    external_url: string;
    course_progress: number;
    total_time: number;
    grade?: string;
    alt_name?: string;
    start_dt?: Date;
    end_dt?: Date;
}

export enum ModalType {
    Edit = 'Edit',
    Add = 'Add',
    Show = 'Show',
    Associate = 'Associate',
    Confirm = 'Confirm',
    Register = 'Register',
    Blank = '',
    Delete = 'Delete'
}
export interface CourseCatalogResponse {
    key: [number, string, boolean];
    course_id: number;
    thumbnail_url: string;
    course_name: string;
    provider_name: string;
    external_url: string;
    course_type: string;
    description: string;
    outcome_types: string;
    start_dt?: Date;
    end_dt?: Date;
}

export interface ProviderPlatform {
    access_key: string;
    account_id: string;
    base_url: string;
    id: number;
    name: string;
    state: ProviderPlatformState;
    type: ProviderPlatformType;
    oidc_id: number;
    [key: string]:
        | string
        | number
        | ProviderPlatformState
        | ProviderPlatformType;
}

export enum ProviderPlatformState {
    ENABLED = 'enabled',
    DISABLED = 'disabled',
    ARCHIVED = 'archived'
}

export enum OpenContentTabs {
    KIWIX = 'Libraries',
    VIDEOS = 'Videos',
    LINKS = 'Helpful Links',
    FAVORITES = 'Favorites'
}

export enum ProviderPlatformType {
    CANVAS_CLOUD = 'canvas_cloud',
    CANVAS_OSS = 'canvas_oss',
    KOLIBRI = 'kolibri',
    BRIGHTSPACE = 'brightspace'
}

export enum CreditType {
    ACADEMIC_CREDIT = 'Academic Credit',
    PARTICIPATION_CREDIT = 'Participation Credit',
    CERTIFICATE_OF_COMPLETION = 'Certificate of Completion',
    EARNED_TIME_CREDIT = 'Earned-Time Credit',
    REHABILITATION_CREDIT = 'Rehabilitation Credit'
}

export enum ProgramStatus {
    AVAILABLE = 'AVAILABLE',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ARCHIVED = 'ARCHIVED'
}

export enum ProgramType {
    EDUCATIONAL = 'EDUCATIONAL',
    VOCATIONAL = 'VOCATIONAL',
    LIFE_SKILLS = 'LIFE SKILLS',
    THERAPEUTIC = 'THERAPEUTIC'
}

export interface LearningInsight {
    course_name: string;
    total_students_enrolled: number;
    total_students_completed: number;
    completion_rate: number;
    activity_hours: number;
}

export interface AdminLayer2Join {
    data: {
        total_courses_offered: number;
        total_students_enrolled: number;
        total_hourly_activity: number;
        learning_insights: LearningInsight[];
    };
    last_cache: string;
}

export interface EventCalendar {
    month: Month;
    year: number;
}

export interface Month {
    name: string;
    days: Day[];
}

export interface Day {
    date: string;
    events: Event[];
}
export interface Event {
    event_id: number;
    section_id: number;
    start_time: string;
    duration: number;
    is_cancelled: boolean;
    location: string;
    program_name: string;
}

export interface OverrideForm {
    start_time: string;
    date: string;
    override_type: string;
    program_name?: string;
    location?: string;
    override_rule?: string;
    is_cancelled?: boolean;
    duration?: string;
}
export const parseDuration = (duration: number): string => {
    const hours = Math.floor(duration / 3.612);
    const minutes = Math.floor((duration % 3.612) / 6e10);
    return `${hours}h ${minutes}m`;
};

export interface RecentCourse {
    course_name: string;
    description: string;
    course_progress: number;
    alt_name: string;
    thumbnail_url: string;
    provider_platform_name: string;
    external_url: string;
    id?: number;
    total_time?: number;
    start_dt?: Date;
    end_dt?: Date;
}

export interface CourseMilestones {
    name: string;
    milestones: number;
}

export interface CourseActivity {
    course_name: string;
    hours_engaged: number;
}

export interface RecentActivity {
    date: string;
    delta: number;
}

export interface Tab {
    name: string;
    value: string | number;
}

export type Link = Record<string, string>;

export interface HelpfulLinkAndSort {
    helpful_links: HelpfulLink[];
    sort_order: string;
    meta: PaginationMeta;
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

export interface YAxisTickProps {
    x: number;
    y: number;
    payload: {
        value: string;
    };
}

export enum PillTagType {
    Open = 'open_enrollment',
    Permission = 'fixed_enrollment',
    SelfPaced = 'open_content'
}

export interface ModalProps {
    type: ModalType | string;
    item: string;
    form: ReactNode | undefined;
}

export enum OutcomePillType {
    Certificate = 'certificate',
    CollegeCredit = 'college_credit'
}

export enum CourseStatus {
    Current = 'Current',
    Completed = 'Completed',
    Pending = 'Pending',
    Recent = 'Recent'
}
export enum ViewType {
    Grid = 'Grid',
    List = 'List'
}

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

export interface Program {
    id: number;
    created_at: Date;
    updated_at: Date;
    name: string;
    description: string;
    tags: ProgramTag[];
    is_favorited: boolean;
    facilities: Facility[];
}

export interface ProgramTag {
    id: string;
    value: number;
}

export enum LibraryAdminVisibility {
    'All Libraries' = 'all',
    'Visible' = 'visible',
    'Hidden' = 'hidden',
    'Featured' = 'featured'
}

export enum FilterLibrariesVidsandHelpfulLinksAdmin {
    'Title (A to Z)' = 'title ASC',
    'Title (Z to A)' = 'title DESC',
    'Date Added (Newest First)' = 'created_at DESC',
    'Date Added  (Oldest First)' = 'created_at ASC',
    'Most Popular' = 'most_popular'
}

export enum FilterLibrariesVidsandHelpfulLinksResident {
    'Title (A to Z)' = 'title ASC',
    'Title (Z to A)' = 'title DESC',
    'Date Added (Newest First)' = 'created_at DESC',
    'Date Added  (Oldest First)' = 'created_at ASC'
}

export enum Timezones {
    'america/chicago' = 'America/Chicago',
    'america/new_york' = 'America/New_York',
    'america/anchorage' = 'America/Anchorage',
    'america/los_angeles' = 'America/Los_Angeles',
    'america/denver' = 'America/Denver',
    'america/phoenix' = 'America/Phoenix'
}

export enum FilterPastTime {
    'Past 7 days' = '7',
    'Past 30 days' = '30',
    'Past 90 days' = '90',
    'Past 6 months' = '182',
    'Past year' = '365'
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
export interface TitleHandler {
    title: string;
    path?: string[];
}
export interface ActivityMapData {
    date: string;
    total_time: string;
    quartile: number;
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

export interface Option {
    key: number;
    value: string;
}
