import { Attendance, Room, SelectedClassStatus } from '@/common';

// ClassEventInstance represents a single scheduled class event with attendance records
export interface ClassEventInstance extends ProgramClassEvent {
    event_id: number;
    date: string;
    class_time: string;
    attendance_records: ProgramClassEventAttendance[];
}

// TO DO: NOTE THESE WILL BE REPLACED IN A FUTURE TICKET. LEAVING IT AS IS FOR NOW
// ShortCalendarEvent represents a basic calendar event with a title and time range.
export interface ShortCalendarEvent {
    title: string;
    start: Date;
    end: Date;
}

// ProgramClassEventAttendance Represents a single user's attendance record for a class event, including status and notes.
export interface ProgramClassEventAttendance {
    id: number;
    created_at: Date;
    updated_at: Date;
    event_id: number;
    user_id: number;
    date: string;
    attendance_status: Attendance;
    note: string;
}

// ProgramClassEvent represents a single class event, including scheduling, recurrence, and override rules.
export interface ProgramClassEvent {
    id: number;
    class_id: number;
    duration: string;
    room_id: number;
    room_ref?: Room;
    recurrence_rule: string;
    is_cancelled: boolean;
    overrides: ProgramClassEventOverride[];
}

// ProgramClassEventOverride represents an override or exception to a recurring class event, such as cancellations or rescheduling.
export interface ProgramClassEventOverride {
    id: number;
    event_id: number;
    override_rrule: string;
    duration: string;
    room_id?: number;
    room_ref?: Room;
    is_cancelled: boolean;
    reason: string;
}

// FacilityProgramClassEvent represents a detailed scheduled class event at a facility, including instructor, program, calendar, and override info.
export interface FacilityProgramClassEvent extends ProgramClassEvent {
    room: string; // populated from joined rooms table in calendar query
    instructor_name: string;
    program_id: number;
    program_name: string;
    title: string;
    is_override: boolean;
    enrolled_users: string;
    start: Date;
    end: Date;
    frequency: string;
    override_id: number;
    linked_override_event: FacilityProgramClassEvent;
    credit_types: string;
    class_status: SelectedClassStatus;
}

// Instructor represents a user who can teach classes
export interface Instructor {
    id: number;
    username: string;
    name_first: string;
    name_last: string;
    email: string;
}

// Bulk cancellation preview data
export interface BulkCancelSessionsPreview {
    sessionCount: number;
    upcomingSessionCount: number;
    classCount: number;
    studentCount: number;
    classes: AffectedClass[];
}

// Individual class affected by bulk cancellation
export interface AffectedClass {
    classId: number;
    className: string;
    upcomingSessions: number;
    cancelledSessions: number;
    studentCount: number;
}

// Bulk cancellation request payload
export interface BulkCancelSessionsRequest {
    instructorId: number;
    startDate: string;
    endDate: string;
    reason: string;
}

// Instructor class data response from API
export interface InstructorClassData {
    id: number;
    name: string;
    sessionCount: number;
    enrolledCount: number;
    upcomingSessions: number;
    cancelledSessions: number;
}

export interface BulkCancelSessionsResponse {
    success: boolean;
    sessionCount: number;
    classCount: number;
    studentCount: number;
    alreadyCancelledCount?: number;
    message?: string;
    classes: AffectedClass[];
}
