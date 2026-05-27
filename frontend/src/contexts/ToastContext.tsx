import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ToastState } from '@/types';
import { ToastContext } from '@/contexts/useToast';

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
            <Toaster position="bottom-right" />
        </ToastContext.Provider>
    );
};
