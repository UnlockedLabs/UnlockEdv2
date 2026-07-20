import { ProgramType, FundingType } from './program';

export enum ReportType {
    ATTENDANCE = 'attendance',
    PROGRAM_OUTCOMES = 'program_outcomes',
    FACILITY_COMPARISON = 'facility_comparison',
    CLASS_ROSTER = 'class_roster',
    RESIDENT_PROFILE = 'resident_profile'
}

export enum ReportFormat {
    CSV = 'csv',
    PDF = 'pdf',
    EXCEL = 'excel'
}

export interface ReportGenerateRequest {
    type: ReportType;
    format: ReportFormat;
    start_date: string;
    end_date: string;
    facility_id?: number;
    facility_ids?: number[];
    program_id?: number;
    program_ids?: number[];
    class_id?: number;
    user_id?: number;
    class_status?: string;
    program_types?: ProgramType[];
    funding_types?: FundingType[];
    // Programs Export options
    include_class_breakdown?: boolean;
    include_inactive?: boolean;
    // Class Roster options
    enrollment_statuses?: string[];
    include_incomplete_reason?: boolean;
    include_attendance_rate?: boolean;
    include_enrollment_dates?: boolean;
}
