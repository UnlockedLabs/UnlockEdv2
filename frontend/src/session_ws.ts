import { WsMsg, WsEventType, OcActivityUpdate, User } from './common';

export class WebsocketSession {
    private socket: WebSocket | null = null;
    private currentActivityId = 0;
    private readonly session_id: string;
    private readonly userId: number;
    private readonly reconnectInterval: number = 5000; // 5 seconds delay before retrying
    private currentMsgHandler: (msg: Partial<WsMsg>) => void = () => {
        return;
    };

    constructor(user: User) {
        this.userId = user.id;
        this.session_id = user.session_id;
        this.addWindowListeners();
    }

    // adds event listeners to re-establish the connection
    private addWindowListeners(): void {
        window.addEventListener('focus', this.handleFocusChange);
        window.addEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.addEventListener('logoutEvent', this.handleLogout);
    }

    private removeWindowListeners(): void {
        window.removeEventListener('focus', this.handleFocusChange);
        window.removeEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.removeEventListener('logoutEvent', this.handleLogout);
    }

    private handleFocusChange = (): void => {
        if (this.socket && document.hidden){
            this.tearDownConnection(false);
        }else if (!this.socket) {
            this.createConnection();
        }
    };

    private handleVisibilityChange = (): void => {
        if (!document.hidden && !this.socket) {
            this.createConnection();
        } else if (document.hidden && this.socket){
            this.tearDownConnection(false);
        }
    };

    private handleLogout = (): void => {
        this.tearDownConnection(true);
    };

    // public API to connect or reconnect the websocket
    public connect(): void {
        this.createConnection();
    }

    // creates the websocket connection and sets up its event handlers
    private createConnection(): void {
        if (this.socket) return; // already exists
        const webSocketUrl = `/api/ws/listen`;
        this.socket = new WebSocket(webSocketUrl);

        this.socket.onopen = () => {
            // send an initial message with session details for client hello
            const message: WsMsg = {
                event_type: WsEventType.ClientHello,
                msg: {
                    msg: 'client_hello',
                    activity_id: 0
                },
                user_id: this.userId,
                session_id: this.session_id
            };
            this.sendMessage(message);
        };

        this.socket.onmessage = (event: MessageEvent<string>) => {
            const msg = this.defaultMsgHandler(event);
            this.currentMsgHandler(msg);
        };

        this.socket.onclose = (event: CloseEvent) => {
            console.warn('WebSocket closed:', event.reason);
            this.socket = null;
            setTimeout(() => {
                if (!document.hidden){
                    this.createConnection();
                }
            }, this.reconnectInterval);
        };

        this.socket.onerror = (error: Event) => {
            console.error('WebSocket error:', error);
        };
    }

    public notifyOpenContentActivity(cleanup?: boolean): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const msg: WsMsg = {
                event_type: WsEventType.VisitEvent,
                msg: {
                    activity_id: this.currentActivityId,
                    msg: ''
                },
                user_id: this.userId,
                session_id: this.session_id
            };
            this.socket.send(JSON.stringify(msg));
        } else {
            this.connect();
        }
        if (cleanup) {
            this.currentActivityId = 0;
        }
    }

    // public API to send messages to the backend.
    public sendMessage(msg: WsMsg): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg));
        } else {
            console.warn('WebSocket is not open. Message not sent:');
        }
    }

    public tearDownConnection(removeListeners: boolean): void {
        if (this.socket) {
            const sessionMessage: WsMsg = {
                event_type: WsEventType.ClientGoodbye,
                user_id: this.userId,
                session_id: this.session_id,
                msg: { activity_id: this.currentActivityId, msg: '' }
            };
            this.sendMessage(sessionMessage);
            this.socket.close();
            this.socket = null;
        }
        if (removeListeners) {
            this.removeWindowListeners();
        }
    }

    public setMsgHandler(handler: (msg: Partial<WsMsg>) => void): void {
        this.currentMsgHandler = handler;
    }

    public resetMsgHandler(): void {
        this.currentMsgHandler = () => {
            return;
        };
    }

    private defaultMsgHandler(event: MessageEvent<string>): Partial<WsMsg> {
        try {
            const data = JSON.parse(event.data) as Partial<WsMsg>;
            // if an activity_id is received, end any prior activity and update the id.
            if (data.event_type !== undefined) {
                if (data.event_type === WsEventType.VisitEvent) {
                    if (this.currentActivityId !== 0) {
                        this.notifyOpenContentActivity();
                    }
                    this.currentActivityId = (
                        data.msg as OcActivityUpdate
                    ).activity_id;
                }
            }
            return data;
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
        return {} as Partial<WsMsg>;
    }
}

declare global {
    interface Window {
        websocket?: WebsocketSession;
    }
}

export default WebsocketSession;
