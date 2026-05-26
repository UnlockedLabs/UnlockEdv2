import type { ActivityHistoryAction } from './insights';

export interface PaginationMeta {
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export interface ServerResponseBase {
    success: boolean;
    message: string;
    status?: number;
    headers?: Record<string, string>;
}

export interface ServerResponseOne<T> extends ServerResponseBase {
    type: 'one';
    data: T;
}

export interface ServerResponseMany<T> extends ServerResponseBase {
    type: 'many';
    data: T[];
    meta: PaginationMeta;
}

export type ServerResponse<T> = ServerResponseOne<T> | ServerResponseMany<T>;

export interface ChangeLogEntry {
    id: number;
    table_name: string;
    parent_ref_id: number;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    user_id: number;
    username: string;
    action?: ActivityHistoryAction;
    user_username?: string;
    admin_username?: string;
    facility_name?: string;
    program_classes_history_id?: number;
    attendance_status?: string;
    class_name?: string;
    session_date?: string;
}
