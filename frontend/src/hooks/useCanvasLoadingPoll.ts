import { useEffect, useRef, useState } from 'react';

/**
 * Polls `mutate` every `intervalMs` while `shouldPoll` is true, up to
 * `maxAttempts` times. Returns `exhausted: true` once the limit is hit
 * without `shouldPoll` clearing, so the caller can show a retry message.
 * Cleans up automatically on unmount.
 */
export function useCanvasLoadingPoll(
    shouldPoll: boolean,
    mutate: () => void,
    { maxAttempts = 10, intervalMs = 5000 } = {}
): { exhausted: boolean } {
    const countRef = useRef(0);
    const [exhausted, setExhausted] = useState(false);

    useEffect(() => {
        if (!shouldPoll) {
            countRef.current = 0;
            setExhausted(false);
            return;
        }
        if (countRef.current >= maxAttempts) return;
        const id = setInterval(() => {
            countRef.current += 1;
            mutate();
            if (countRef.current >= maxAttempts) {
                clearInterval(id);
                setExhausted(true);
            }
        }, intervalMs);
        return () => clearInterval(id);
    }, [shouldPoll, mutate, maxAttempts, intervalMs]);

    return { exhausted };
}
