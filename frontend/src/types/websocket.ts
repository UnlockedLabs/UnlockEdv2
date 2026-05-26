export enum WsEventType {
    ClientHello = 'client_hello',
    ClientGoodbye = 'client_goodbye',
    Pong = 'pong',
    VisitEvent = 'visits',
    BookmarkEvent = 'bookmarks'
}

export interface OcActivityUpdate {
    activity_id: number;
}

export interface WsMsg {
    event_type: WsEventType;
    msg: MsgContent;
    user_id: number;
    session_id?: string;
}

export interface MsgContent {
    activity_id: number;
    msg: string;
}
