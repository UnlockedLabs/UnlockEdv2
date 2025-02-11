import { useEffect, useRef, useState } from 'react';

interface WebSocketEvent {
    event_type: string;
    page: string;
    timestamp: number;
    user_id: number;
    activity_id: number;
}

/**
 * FIXME INPROGRSS
 */
export default function useWebSocketTracker(userId: number, contentId?: string, onActivityUpdate?: (activityId: number) => void) {
    const [activityID, setActivityID] = useState<number>(0);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const socketRef = useRef<WebSocket | null>(null);
    const activityIDRef = useRef<number>(0);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const host = window.location.hostname;
        const webSocketUrl = `${protocol}${host}/api/ws/listen`;

        const socket = new WebSocket(webSocketUrl);
        socketRef.current = socket;

        console.log('WebSocket connecting...');

        socket.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        };

        socket.onmessage = (event: MessageEvent<string>) => {
            try {
                const eventData = JSON.parse(event.data) as Partial<WebSocketEvent>;
                console.log("Received WebSocket message:", eventData.activity_id);

                if (eventData.activity_id !== undefined) {
                    if (activityIDRef.current !== 0) {
                        const closeEvent: WebSocketEvent = {
                            event_type: "close_previous_activity",
                            page: window.location.pathname,
                            timestamp: Date.now(),
                            user_id: userId,
                            activity_id: activityIDRef.current,
                        };
                        socket.send(JSON.stringify(closeEvent));
                        console.log("Sent close_previous_activity event:", closeEvent);
                    }
                    setActivityID(eventData.activity_id);
                    activityIDRef.current = eventData.activity_id;
                    if (onActivityUpdate) {
                        onActivityUpdate(eventData.activity_id);
                    }
                }
                console.log("Updated activityIDRef (useRef):", activityIDRef.current);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        const closeWebSocket = () => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                console.log("Sending latest activityID before closing:", activityIDRef.current);

                const event: WebSocketEvent = {
                    event_type: "test",
                    page: "12",
                    timestamp: Date.now(),
                    user_id: userId,
                    activity_id: activityIDRef.current,
                };
                socket.send(JSON.stringify(event));
                console.log("Closing WebSocket...");
            }

            if (socketRef.current) {
                socketRef.current.close();
            }
        };

        const handleLogout = () => {
            console.log("Detected logout event. Closing WebSocket...");
            closeWebSocket();
        };

        window.addEventListener("logoutEvent", handleLogout);
        return () => {
            console.log("WebSocket cleanup triggered...");
            closeWebSocket();
            window.removeEventListener("logoutEvent", handleLogout);
        };
    }, [contentId]);

    /**
     * **NEW: Send message whenever activityID changes**
     */
    useEffect(() => {
        if (isConnected && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("Updated activityIDRef before sending message:", activityID);
        }
    }, [activityID]);
    return { activityID, isConnected };
}