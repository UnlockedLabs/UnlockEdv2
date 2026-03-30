import { createContext, useContext } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ToastState } from '@/types';

export interface ToastContextType {
    toaster: (msg: string, state: ToastState) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

function toaster(msg: string, state: ToastState) {
    switch (state) {
        case ToastState.success:
            toast.success(msg);
            break;
        case ToastState.error:
            toast.error(msg);
            break;
        default:
            toast(msg);
            break;
    }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    return (
        <ToastContext.Provider value={{ toaster }}>
            {children}
            <Toaster />
        </ToastContext.Provider>
    );
};
