import { ProgramType, FundingType } from './program';

export enum ReportType {
    ATTENDANCE = 'attendance',
    PROGRAM_OUTCOMES = 'program_outcomes',
    FACILITY_COMPARISON = 'facility_comparison'
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
    class_id?: number;
    user_id?: number;
    class_status?: string;
    program_types?: ProgramType[];
    funding_types?: FundingType[];
}
