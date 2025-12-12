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
