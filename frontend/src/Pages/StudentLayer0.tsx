import { useAuth } from '@/useAuth';

export default function StudentLayer0() {
    const { user } = useAuth();
    return (
        <div className="card card-title">
            <h1 className="text-2xl"> Hi, {user?.name_first ?? 'Student'}! </h1>
            <h2 className="text-xl"> Welcome to UnlockEd</h2>
            <img
                src="/ul-logo.png"
                alt="UnlockEd Logo"
                className="w-125px h-125px"
            />
            <div className="card card-row-padding"></div>
        </div>
    );
}
