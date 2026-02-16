import ChangePasswordForm from '@/components/forms/ChangePasswordForm';
import { Link } from 'react-router-dom';

export default function ResetPassword() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted">
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
                <h2 className="text-xl font-semibold text-foreground mb-4">
                    Reset Password
                </h2>
                <ChangePasswordForm />
            </div>
        </div>
    );
}
