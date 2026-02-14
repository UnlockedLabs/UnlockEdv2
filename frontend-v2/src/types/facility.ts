export interface Facility {
    [key: string]: string | number;
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    timezone: string;
}

export interface Room {
    id: number;
    facility_id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface RoomConflict {
    conflicting_event_id: number;
    conflicting_class_id: number;
    class_name: string;
    start_time: string;
    end_time: string;
}

export enum Timezones {
    'CST' = 'America/Chicago',
    'EST' = 'America/New_York',
    'AKST' = 'America/Anchorage',
    'PST' = 'America/Los_Angeles',
    'MDT' = 'America/Denver',
    'MST' = 'America/Phoenix'
}
