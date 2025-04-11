import WebsocketSession from '@/session_ws';

declare global {
    interface Window {
        websocket?: WebsocketSession;
    }

    interface HTMLDialogElement {
        showModal: () => void;
    }
}
