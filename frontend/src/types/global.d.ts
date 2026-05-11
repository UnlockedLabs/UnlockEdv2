declare global {
    interface Window {
        websocket?: import('@/session/websocket').default;
    }
}

export {};
