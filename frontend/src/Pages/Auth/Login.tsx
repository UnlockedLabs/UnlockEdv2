import LoginForm from '@/Components/forms/LoginForm';
import GuestLayout from '@/Layouts/GuestLayout';
import { BROWSER_URL } from '@/common';

export default function Login({ status }: { status?: string }) {
    if (!window.location.search.includes('flow')) {
        window.location.href = BROWSER_URL;
    }
    return (
        <div title="Log in">
            <GuestLayout>
                {status && (
                    <div className="mb-4 font-medium text-sm text-body-text bg-background">
                        {status}
                    </div>
                )}
                <LoginForm />
            </GuestLayout>
        </div>
    );
}
