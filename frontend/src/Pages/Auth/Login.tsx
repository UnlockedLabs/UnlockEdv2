import LoginForm from '@/Components/forms/LoginForm';
import GuestLayout from '@/Layouts/GuestLayout';
import { INIT_KRATOS_LOGIN_FLOW } from '@/common';

export default function Login({ status }: { status?: string }) {
    if (!window.location.search.includes('flow')) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
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
