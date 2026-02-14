import { Facility } from './facility';

export enum UserRole {
    SystemAdmin = 'system_admin',
    DepartmentAdmin = 'department_admin',
    FacilityAdmin = 'facility_admin',
    Student = 'student'
}

export enum ResidentAccountAction {
    'Download Usage Report (PDF)' = 'download',
    'Export Attendance' = 'export_attendance',
    'Transfer Resident' = 'transfer',
    'Delete Resident' = 'delete',
    'Deactivate Resident' = 'deactivate'
}

export enum FeatureAccess {
    ProviderAccess = 'provider_platforms',
    OpenContentAccess = 'open_content',
    ProgramAccess = 'program_management',
    RequestContentAccess = 'request_content',
    HelpfulLinksAccess = 'helpful_links',
    UploadVideoAccess = 'upload_video'
}

export interface User {
    id: number;
    name_first: string;
    name_last: string;
    username: string;
    doc_id?: string;
    role: UserRole;
    email: string;
    password_reset?: boolean;
    session_id: string;
    created_at: string;
    updated_at: string;
    facility: Facility;
    feature_access: FeatureAccess[];
    timezone: string;
    facilities?: Facility[];
    login_metrics: LoginMetrics;
    deactivated_at?: string | null;
    [key: string]:
        | number
        | string
        | boolean
        | undefined
        | null
        | FeatureAccess[]
        | Facility[]
        | Facility
        | LoginMetrics;
}

export interface LoginMetrics {
    user_id: number;
    total: number;
    last_login: string;
}

export interface NewUserResponse {
    user: User;
    temp_password: string;
}

export interface ResetPasswordResponse {
    temp_password: string;
    message: string;
}

export interface ValidResident {
    user: User;
    program_names: TransferResidentProgamConflicts[];
    trans_facility_id: number;
    transfer_to?: string;
    transfer_from?: string;
}

export interface TransferResidentProgamConflicts {
    program_name: string;
    class_name: string;
}

export interface ValidatedUserRow {
    row_number: number;
    last_name: string;
    first_name: string;
    resident_id: string;
    username: string;
}

export interface InvalidUserRow extends ValidatedUserRow {
    error_reasons: string[];
}

export interface BulkUploadResponse {
    valid_count: number;
    error_count: number;
    valid_rows: ValidatedUserRow[];
    invalid_rows: InvalidUserRow[];
    error_csv_data?: string;
}

export enum FilterResidentNames {
    'Resident Name (A-Z)' = 'name_last asc',
    'Resident Name (Z-A)' = 'name_last desc'
}
