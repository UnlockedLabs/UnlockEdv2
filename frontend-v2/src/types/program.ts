import { Facility } from './facility';
import { ProgramClassEvent } from './events';
import {
    SelectedClassStatus,
    EnrollmentStatus,
    ClassEnrollment
} from './attendance';
import { User } from './user';

export enum FundingType {
    EDUCATIONAL_GRANTS = 'Educational_Grants',
    FEDERAL_GRANTS = 'Federal_Grants',
    INMATE_WELFARE = 'Inmate_Welfare_Funds',
    NON_PROFIT_ORGANIZATION = 'Nonprofit_Organizations',
    STATE_GRANTS = 'State_Grants',
    OTHER = 'Other'
}

export enum ProgramType {
    EDUCATIONAL = 'Educational',
    LIFE_SKILLS = 'Life_Skills',
    MENTAL_HEALTH = 'Mental_Health_Behavioral',
    RELIGIOUS = 'Religious_Faith-Based',
    RE_ENTRY = 'Re-Entry',
    THERAPEUTIC = 'Therapeutic',
    VOCATIONAL = 'Vocational'
}


export enum CreditType {
    COMPLETION = 'Completion',
    EARNED_TIME = 'Earned-time',
    EDUCATION = 'Education',
    PARTICIPATION = 'Participation'
}

export enum ProgClassStatus {
    SCHEDULED = 'Scheduled',
    ACTIVE = 'Active',
    CANCELLED = 'Cancelled',
    COMPLETED = 'Completed',
    PAUSED = 'Paused'
}

export enum ProgramEffectiveStatus {
    Available = 'Available',
    Inactive = 'Inactive',
    Archived = 'Archived'
}

export type ProgramAction =
    | 'set_available'
    | 'set_inactive'
    | 'archive'
    | 'reactivate';

export interface ProgramCreditType {
    credit_type: CreditType;
    program_id?: number;
}

export interface PgmType {
    program_type: ProgramType;
    program_id?: number;
}

export interface ProgramTag {
    id: string;
    value: number;
}

export interface Program {
    id: number;
    created_at: Date;
    updated_at: Date;
    name: string;
    description: string;
    credit_types: ProgramCreditType[];
    funding_type: FundingType;
    program_types: PgmType[];
    is_active: boolean;
    tags: ProgramTag[];
    is_favorited: boolean;
    facilities: Facility[];
    archived_at: string;
}

export interface ProgramOverview extends Program {
    active_residents: number;
    active_enrollments: number;
    completions: number;
    total_enrollments: number;
    completion_rate: number;
    attendance_rate: number;
    active_class_facility_ids: number[];
}

export interface ProgramClassOutcomes {
    month: string;
    completions: number;
    drops: number;
}

export interface ProgramsFacilitiesStats {
    total_programs: number;
    avg_active_programs_per_facility: number;
    total_enrollments: number;
    attendance_rate: number;
    completion_rate: number;
}

export interface ProgramsOverviewTable {
    program_id: number;
    program_name: string;
    description: string;
    archived_at: string;
    total_active_facilities: number;
    total_enrollments: number;
    total_active_enrollments: number;
    total_classes: number;
    total_active_classes: number;
    total_capacity: number;
    completion_rate: number;
    attendance_rate: number;
    program_types: string;
    credit_types: string;
    funding_type: string;
    status: boolean;
}

export interface ProgramsOverview {
    programs_facilities_stats: ProgramsFacilitiesStats;
    programs_table: ProgramsOverviewTable[];
}

export interface Class {
    id: number;
    program_id: number;
    facility_id: number;
    facility_name: string;
    facility?: Facility;
    instructor_name: string;
    instructor_id?: number | null;
    instructor?: User | null;
    name: string;
    description: string;
    start_dt: string;
    end_dt: string;
    status: SelectedClassStatus;
    enrolled: number;
    completed: number;
    historical_enrollments?: number;
    capacity: number;
    credit_hours: number;
    archived_at: string | null;
    enrollments?: ClassEnrollment[];
    events: ProgramClassEvent[];
    created_at: Date;
    program: Program;
    schedule?: string;
    room?: string;
    attendance_rate?: number;
}

export interface MissingAttendanceItem {
    class_id: number;
    class_name: string;
    facility_name?: string;
    event_id: number;
    date: string;
    start_time: string;
}

export interface TodaysScheduleItem {
    class_id: number;
    class_name: string;
    instructor_name: string;
    facility_id: number;
    facility_name: string;
    event_id: number;
    date: string;
    start_time: string;
    room: string;
}

export interface ClassMetrics {
    active_classes: number;
    scheduled_classes: number;
    total_enrollments: number;
    total_seats: number;
    attendance_concerns: number;
}

export interface FacilityHealthSummary {
    facility_id: number;
    facility_name: string;
    programs: number;
    active_classes: number;
    enrollment: number;
    missing_attendance: number;
    attendance_concerns: number;
}

export interface ResidentProgramOverview {
    program_name: string;
    class_name: string;
    status: ProgClassStatus;
    credit_types: string;
    program_id: number;
    class_id: number;
    updated_at: string;
    enrollment_status?: EnrollmentStatus;
    start_date: string;
    end_date?: string;
    present_attendance?: number;
    absent_attendance?: number;
    attendance_percentage?: number;
    change_reason?: string;
    schedule?: string;
}

export interface ProgramCompletion {
    id: number;
    program_class_id: number;
    facility_name: string;
    credit_type: string;
    admin_email: string;
    program_owner?: string;
    program_name: string;
    program_id: number;
    program_class_name: string;
    program_class_start_dt: string;
    created_at: string;
    updated_at: string;
    deleted_at: string;
    enrolled_on_dt: string;
    user?: User;
}

export interface ConflictDetail {
    user_id: number;
    user_name: string;
    conflicting_class: string;
    conflict_start: string;
    conflict_end: string;
    reason: string;
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

export enum CancelEventReason {
    'Instructor unavailable' = 'Instructor unavailable',
    'Instructor illness' = 'Instructor illness',
    'Facility issue or lockdown' = 'Facility issue or lockdown',
    'Holiday or scheduled break' = 'Holiday or scheduled break',
    'Technology issue' = 'Technology issue',
    'Other (add note)' = 'Other (add note)'
}

export enum ClassStatusOptions {
    Complete = 'Complete',
    Pause = 'Pause',
    Cancel = 'Cancel',
    Schedule = 'Schedule',
    Active = 'Active'
}

export enum ClassMgmtTabs {
    CLASS = 'Dashboard',
    SCHEDULE = 'Schedule',
    ENROLLMENT = 'Enrollment',
    ATTENDANCE = 'Attendance'
}

export enum FilterProgramClassEnrollments {
    'Last Name (A to Z)' = 'name_last asc',
    'Last Name (Z to A)' = 'name_last desc',
    'First Name (A to Z)' = 'name_first asc',
    'First Name (Z to A)' = 'name_first desc'
}
