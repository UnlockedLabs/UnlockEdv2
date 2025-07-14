import { Attendance } from '@/common';

export interface Event {
    event_id: number;
    class_id: number;
    start_time: string;
    duration: number;
    is_cancelled: boolean;
    location: string;
    program_name: string;
}

export interface EventDate {
    event_id: number;
    date: string;
}

export interface CalendarEvent {
    event_id: number;
    class_id: number;
    program_name: string;
    start_time: string;
    duration: number;
    location: string;
    is_cancelled: boolean;
}

export interface StudentCalendar {
    day_index: number;
    date: string;
    events: CalendarEvent[];
}

// TO DO: NOTE THESE WILL BE REPLACED IN A FUTURE TICKET. LEAVING IT AS IS FOR NOW
export interface ShortCalendarEvent {
    title: string;
    start: Date;
    end: Date;
}

export interface EventDate {
    event_id: number;
    date: string;
}

export interface ClassEventInstance {
    is_cancelled: boolean;
    event_id: number;
    class_time: string;
    date: string;
    attendance_records: ProgramClassEventAttendance[];
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
    room: string;
    recurrence_rule: string;
    overrides: ProgramClassEventOverride[];
}

export interface ProgramClassEventOverride {
    id: number;
    event_id: number;
    override_rrule: string;
    duration: string;
    room: string;
    is_cancelled: boolean;
    reason: string;
}

export interface FacilityProgramClassEvent extends ProgramClassEvent {
    instructor_name: string;
    program_name: string;
    title: string;
    is_cancelled: boolean;
    is_override: boolean;
    enrolled_users: string;
    start: Date;
    end: Date;
    frequency: string;
    override_id: number;
    linked_override_event: FacilityProgramClassEvent;
    credit_types: string;
}
