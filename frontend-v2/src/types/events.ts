import { Attendance, SelectedClassStatus } from './attendance';
import { Room } from './facility';

export interface ClassEventInstance extends ProgramClassEvent {
    event_id: number;
    date: string;
    class_time: string;
    attendance_records: ProgramClassEventAttendance[];
}

export interface ShortCalendarEvent {
    title: string;
    start: Date;
    end: Date;
}

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

export interface FacilityProgramClassEvent extends ProgramClassEvent {
    room: string;
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

export interface Instructor {
    id: number;
    username: string;
    name_first: string;
    name_last: string;
    email: string;
}

export interface BulkCancelSessionsPreview {
    sessionCount: number;
    upcomingSessionCount: number;
    classCount: number;
    studentCount: number;
    classes: AffectedClass[];
}

export interface AffectedClass {
    classId: number;
    className: string;
    upcomingSessions: number;
    cancelledSessions: number;
    studentCount: number;
}

export interface BulkCancelSessionsRequest {
    instructorId: number;
    startDate: string;
    endDate: string;
    reason: string;
}

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
