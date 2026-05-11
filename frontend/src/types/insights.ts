import { User } from './user';
import { OpenContentResponse } from './content';

export interface DepartmentMetrics {
    data: {
        active_users: number;
        total_logins: number;
        logins_per_day: number;
        percent_active: number;
        percent_inactive: number;
        total_residents: number;
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

export interface ActivityMapData {
    date: string;
    total_time: string;
    quartile: number;
}

export enum CourseStatus {
    Current = 'Current',
    Completed = 'Completed',
    Pending = 'Pending',
    Recent = 'Recent'
}

export interface UserEngagementTimes {
    time_interval: string;
    total_hours: number;
    facility_id: number;
}

export interface EngagementActivityMetrics {
    user_id: number;
    total_active_days_monthly: number;
    total_hours_active_monthly: number;
    total_hours_active_weekly: number;
    total_minutes_active_weekly: number;
    total_hours_engaged: number;
    total_minutes_engaged: number;
    joined: string;
    last_active_date: string;
}

export interface ResidentEngagementProfile {
    user: User;
    session_engagement: UserEngagementTimes[];
    activity_engagement: EngagementActivityMetrics;
    top_libraries: OpenContentResponse[];
    recent_videos: OpenContentResponse[];
}

export interface ActivityHistoryResponse {
    action: ActivityHistoryAction;
    created_at: Date;
    user_id: number;
    user_username: string;
    admin_username?: string;
    facility_name?: string;
    program_classes_history_id?: number;
    program_classes_history?: ProgramClassesHistory;
    field_name: string;
    new_value: string;
    old_value: string;
    attendance_status?: string;
    class_name?: string;
    session_date?: Date;
}

export interface ProgramClassesHistory {
    id: number;
    parent_ref_id: number;
    table_name: string;
    before_update: Record<string, unknown>;
    after_update: Record<string, unknown>;
    created_at: Date;
}

export type ActivityHistoryAction =
    | 'account_creation'
    | 'facility_transfer'
    | 'set_password'
    | 'reset_password'
    | 'progclass_history'
    | 'user_deactivated'
    | 'attendance_recorded';

export enum FilterPastTime {
    'Past 30 days' = '30',
    'Past 90 days' = '90',
    'All time' = 'all'
}
