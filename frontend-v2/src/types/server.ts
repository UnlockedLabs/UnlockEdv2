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
