import { ToastState } from '@/common';
import {
    CheckCircleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface ToastProps {
    state: ToastState;
    message: string;
    reset: () => void;
}

export default function Toast({ state, message, reset }: ToastProps) {
    const [isVisible, setIsVisible] = useState<boolean>(true);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
                reset();
            }, 1000);
        }, 5000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [reset]);

    return (
        <div
            className={`toast transition-opacity duration-500 ease-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <div
                className={`alert text-white ${state == ToastState.success ? 'bg-success' : 'bg-error'}`}
            >
                {state === ToastState.success ? (
                    <CheckCircleIcon className="h-6" />
                ) : (
                    <ExclamationCircleIcon className="h-6" />
                )}
                <span>{message}</span>
            </div>
        </div>
    );
}
