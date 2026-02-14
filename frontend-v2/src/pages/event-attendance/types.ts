import { Attendance } from '@/types';

export interface LocalRowData {
    selected: boolean;
    user_id: number;
    attendance_id?: number;
    doc_id: string;
    name_last: string;
    name_first: string;
    attendance_status?: Attendance;
    note: string;
    reason_category?: string;
    check_in_at?: string;
    check_out_at?: string;
    minutes_attended?: number;
    scheduled_minutes?: number;
}
