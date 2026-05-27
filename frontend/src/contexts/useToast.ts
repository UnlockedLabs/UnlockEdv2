import { createContext, useContext } from 'react';
import { ToastState } from '@/types';

export interface ToastContextType {
    toaster: (msg: string, state: ToastState) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(
    undefined
);

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
