export enum Attendance {
    Present = 'present',
    Partial = 'partial',
    Absent_Excused = 'absent_excused',
    Absent_Unexcused = 'absent_unexcused'
}

export const attendanceLabelMap: Record<Attendance, string> = {
    [Attendance.Absent_Excused]: 'Excused Absence',
    [Attendance.Absent_Unexcused]: 'Unexcused Absence',
    [Attendance.Partial]: 'Partial',
    [Attendance.Present]: 'Present'
};

export enum AttendanceReason {
    Lockdown = 'Lockdown',
    Medical = 'Medical',
    Transfer = 'Transfer',
    Disciplinary = 'Disciplinary',
    Other = 'Other'
}

export enum SelectedClassStatus {
    Scheduled = 'Scheduled',
    Active = 'Active',
    Paused = 'Paused',
    Completed = 'Completed',
    Cancelled = 'Cancelled'
}

export enum EnrollmentStatus {
    Enrolled = 'Enrolled',
    Cancelled = 'Cancelled',
    Completed = 'Completed',
    Withdrawn = 'Incomplete: Withdrawn',
    Dropped = 'Incomplete: Dropped',
    Segregated = 'Incomplete: Segregated',
    'Failed To Complete' = 'Incomplete: Failed to Complete',
    Transfered = 'Incomplete: Transfered'
}

export interface EnrollmentAttendance {
    enrollment_id: number;
    class_id: number;
    user_id: number;
    enrollment_status: string;
    doc_id: string;
    name_first: string;
    name_last: string;
    attendance_id?: number;
    event_id?: number;
    date?: string;
    attendance_status?: Attendance;
    note?: string;
    reason_category?: string;
    check_in_at?: string;
    check_out_at?: string;
    minutes_attended?: number;
    scheduled_minutes?: number;
}

export interface ClassEnrollment {
    id: number;
    created_at: string;
    updated_at: string;
    class_id: number;
    user_id: number;
    enrollment_status: EnrollmentStatus;
    change_reason?: string;
    name_full: string;
    doc_id: string;
    completion_dt?: string;
    enrolled_at?: string;
}

export interface AttendanceFlag {
    name_first: string;
    name_last: string;
    doc_id: string;
    flag_type: AttendanceFlagType;
}

export enum AttendanceFlagType {
    NoAttendance = 'no_attendance',
    MultipleAttendance = 'multiple_absences'
}

export const ClassStatusMap = {
    Complete: SelectedClassStatus.Completed,
    Pause: SelectedClassStatus.Paused,
    Cancel: SelectedClassStatus.Cancelled,
    Schedule: SelectedClassStatus.Scheduled,
    Active: SelectedClassStatus.Active
};
