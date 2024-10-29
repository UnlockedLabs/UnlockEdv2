import { createContext, useContext, useState } from 'react';
import { ToastState } from '@/common';
import Toast from '@/Components/Toast';

export interface ToastContextType {
    toaster: (msg: string, state: ToastState) => void;
}

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export const ToastContext = createContext<ToastContextType | undefined>(
    undefined
);

export const defaultToast = {
    state: ToastState.null,
    message: ''
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [toast, setToast] = useState(defaultToast);
    const [displayToast, setDisplayToast] = useState(false);
    const toaster = (msg: string, state: ToastState) => {
        setDisplayToast(true);
        setToast({ message: msg, state: state });
    };

    return (
        <ToastContext.Provider value={{ toaster }}>
            {children}
            {displayToast && (
                <Toast
                    message={toast.message}
                    state={toast.state}
                    reset={() => setDisplayToast(false)}
                />
            )}
        </ToastContext.Provider>
    );
};
