import {
    ReportType,
    ReportFormat,
    ReportGenerateRequest,
    UserRole,
    ProgramType,
    FundingType
} from '@/common';

export type ReportFieldType =
    | 'date'
    | 'dropdown'
    | 'multi-select'
    | 'facility-select'
    | 'resident-select';

export interface ReportField {
    name: string;
    type: ReportFieldType;
    label: string;
    required?: boolean;
    editable?: boolean;
    options?: string[] | ProgramType[] | FundingType[];
    placeholder?: string;
}

export interface ReportContextData {
    reportType: ReportType;
    facilityId?: number;
    programId?: number;
    classId?: number;
    facilityIds?: number[];
    userId?: number;
}

export interface ReportConfig {
    title: string;
    fields: ReportField[];
    getDefaultValues: (context: ReportContextData) => Record<string, unknown>;
    allowedRoles: UserRole[];
    buildRequest: (
        formValues: Record<string, unknown>,
        context: ReportContextData
    ) => ReportGenerateRequest;
}

function getFirstDayOfMonth(): string {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return first.toISOString().split('T')[0];
}

function getLastDayOfMonth(): string {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.toISOString().split('T')[0];
}

export const ATTENDANCE_CONFIG: ReportConfig = {
    title: 'Export Attendance Report',
    fields: [
        {
            name: 'start_date',
            type: 'date',
            label: 'Start Date',
            required: true
        },
        {
            name: 'end_date',
            type: 'date',
            label: 'End Date',
            required: true
        },
        {
            name: 'user_id',
            type: 'resident-select',
            label: 'Resident (Optional)',
            required: false,
            placeholder: 'All Residents'
        },
        {
            name: 'format',
            type: 'dropdown',
            label: 'Format',
            required: true,
            options: ['csv', 'pdf', 'excel']
        }
    ],
    allowedRoles: [
        UserRole.FacilityAdmin,
        UserRole.DepartmentAdmin,
        UserRole.SystemAdmin
    ],
    getDefaultValues: (context: ReportContextData) => ({
        start_date: getFirstDayOfMonth(),
        end_date: getLastDayOfMonth(),
        format: ReportFormat.CSV,
        facility_id: context.facilityId,
        program_id: context.programId,
        class_id: context.classId,
        user_id: context.userId
    }),
    buildRequest: (
        formValues: Record<string, unknown>,
        context: ReportContextData
    ): ReportGenerateRequest => ({
        type: ReportType.ATTENDANCE,
        format: formValues.format as ReportFormat,
        start_date: `${formValues.start_date as string}T00:00:00Z`,
        end_date: `${formValues.end_date as string}T23:59:59Z`,
        facility_id: context.facilityId,
        program_id: context.programId,
        class_id: context.classId,
        user_id: formValues.user_id ? Number(formValues.user_id) : undefined
    })
};

export const PROGRAM_OUTCOMES_CONFIG: ReportConfig = {
    title: 'Export Program Outcomes Report',
    fields: [
        {
            name: 'start_date',
            type: 'date',
            label: 'Start Date',
            required: true
        },
        {
            name: 'end_date',
            type: 'date',
            label: 'End Date',
            required: true
        },
        {
            name: 'format',
            type: 'dropdown',
            label: 'Format',
            required: true,
            options: ['csv', 'pdf', 'excel']
        },
        {
            name: 'class_status',
            type: 'dropdown',
            label: 'Class Status',
            required: true,
            options: ['Active', 'Not Active', 'All']
        }
    ],
    allowedRoles: [
        UserRole.FacilityAdmin,
        UserRole.DepartmentAdmin,
        UserRole.SystemAdmin
    ],
    getDefaultValues: (context: ReportContextData) => ({
        start_date: getFirstDayOfMonth(),
        end_date: getLastDayOfMonth(),
        format: ReportFormat.CSV,
        class_status: 'Active',
        facility_id: context.facilityId,
        program_id: context.programId
    }),
    buildRequest: (
        formValues: Record<string, unknown>,
        context: ReportContextData
    ): ReportGenerateRequest => ({
        type: ReportType.PROGRAM_OUTCOMES,
        format: formValues.format as ReportFormat,
        start_date: `${formValues.start_date as string}T00:00:00Z`,
        end_date: `${formValues.end_date as string}T23:59:59Z`,
        class_status: formValues.class_status as string,
        facility_id: context.facilityId,
        program_id: context.programId
    })
};

export const FACILITY_COMPARISON_CONFIG: ReportConfig = {
    title: 'Facility Comparison Report',
    fields: [
        {
            name: 'start_date',
            type: 'date',
            label: 'Start Date',
            required: true
        },
        {
            name: 'end_date',
            type: 'date',
            label: 'End Date',
            required: true
        },
        {
            name: 'format',
            type: 'dropdown',
            label: 'Format',
            required: true,
            options: ['csv', 'pdf', 'excel']
        },
        {
            name: 'facility_ids',
            type: 'facility-select',
            label: 'Facilities to Compare',
            required: true,
            placeholder: 'Select at least 2 facilities'
        },
        {
            name: 'program_types',
            type: 'multi-select',
            label: 'Program Types (Optional)',
            options: Object.values(ProgramType)
        },
        {
            name: 'funding_types',
            type: 'multi-select',
            label: 'Funding Types (Optional)',
            options: Object.values(FundingType)
        }
    ],
    allowedRoles: [UserRole.DepartmentAdmin, UserRole.SystemAdmin],
    getDefaultValues: (context: ReportContextData) => ({
        start_date: getFirstDayOfMonth(),
        end_date: getLastDayOfMonth(),
        format: ReportFormat.CSV,
        facility_ids: context.facilityIds ?? [],
        program_types: [],
        funding_types: []
    }),
    buildRequest: (
        formValues: Record<string, unknown>
    ): ReportGenerateRequest => ({
        type: ReportType.FACILITY_COMPARISON,
        format: formValues.format as ReportFormat,
        start_date: `${formValues.start_date as string}T00:00:00Z`,
        end_date: `${formValues.end_date as string}T23:59:59Z`,
        facility_ids: formValues.facility_ids as number[],
        program_types:
            (formValues.program_types as ProgramType[])?.length > 0
                ? (formValues.program_types as ProgramType[])
                : undefined,
        funding_types:
            (formValues.funding_types as FundingType[])?.length > 0
                ? (formValues.funding_types as FundingType[])
                : undefined
    })
};

export function getReportConfig(reportType: ReportType): ReportConfig {
    switch (reportType) {
        case ReportType.ATTENDANCE:
            return ATTENDANCE_CONFIG;
        case ReportType.PROGRAM_OUTCOMES:
            return PROGRAM_OUTCOMES_CONFIG;
        case ReportType.FACILITY_COMPARISON:
            return FACILITY_COMPARISON_CONFIG;
    }
}
