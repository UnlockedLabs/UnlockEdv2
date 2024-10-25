import { defaultToast, showToast, ToastProps, ToastState } from '@/common';
import LibaryLayout from '@/Components/LibraryLayout';
import Toast from '@/Components/Toast';
import { useState } from 'react';

export default function OpenContentManagement() {
    const [displayToast, setDisplayToast] = useState(false);
    const [toast, setToast] = useState<ToastProps>(defaultToast);
    const toaster = (msg: string, state: ToastState) => {
        showToast(setToast, setDisplayToast, msg, state);
    };

    return (
        <div>
            <div className="px-8 pb-4">
                <h1>Open Content Management</h1>
                <LibaryLayout toaster={toaster} />
            </div>
            {/* Toasts */}
            {displayToast && <Toast {...toast} />}
        </div>
    );
}
