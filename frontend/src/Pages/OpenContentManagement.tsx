import { ToastProps, ToastState } from '@/common';
import LibaryLayout from '@/Components/LibraryLayout';
import Toast from '@/Components/Toast';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';

export default function OpenContentManagement() {
    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });

    return (
        <AuthenticatedLayout
            title="Open Content Management"
            path={['Open Content Management']}
        >
            <div className="px-8 pb-4">
                <h1>Open Content Management</h1>
                <LibaryLayout setToast={setToast} />
            </div>
            {/* Toasts */}
            {toast.state !== ToastState.null && (
                <Toast
                    state={toast.state}
                    message={toast.message}
                    reset={() =>
                        setToast({ state: ToastState.null, message: '' })
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
