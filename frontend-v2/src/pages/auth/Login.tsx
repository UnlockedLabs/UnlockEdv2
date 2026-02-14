import LoginForm from '@/components/forms/LoginForm';
import { INIT_KRATOS_LOGIN_FLOW } from '@/types';
import { Link } from 'react-router-dom';

export default function Login() {
    if (!window.location.search.includes('flow')) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
    }
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#E2E7EA]">
            <div className="mb-8">
                <Link to="/">
                    <img
                        className="h-20 hidden dark:block"
                        src="/ul-logo-stacked-med-w.svg"
                        alt="UnlockEd"
                    />
                    <img
                        className="h-20 block dark:hidden"
                        src="/ul-logo-stacked-med-d.svg"
                        alt="UnlockEd"
                    />
                </Link>
            </div>
            <div className="w-full max-w-md px-6 py-4 bg-card shadow-md rounded-lg">
                <LoginForm />
            </div>
        </div>
    );
}
