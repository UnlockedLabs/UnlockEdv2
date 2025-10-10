import { useAuth } from '@/useAuth';

export default function StudentLayer0() {
    const { user } = useAuth();
    return (
        <div className="card card-title">
            <h1 className="text-2xl"> Hi, {user?.name_first ?? 'Student'}! </h1>
            <h2 className="text-xl"> Welcome to UnlockEd</h2>
            <img
                src="/ul-logo-w.svg"
                alt="UnlockEd Logo"
                className="w-32 h-32 logo-dark"
            />
            <img
                src="/ul-logo-d.svg"
                alt="UnlockEd Logo"
                className="w-32 h-32 logo-light"
            />
            <div title="Error" />
            <div className="text-center">
                <div className="mb-4 font-medium text-xl text-red-600">
                    Please contact your administrator to get access to
                    application features
                </div>
            </div>
        </div>
    );
}
