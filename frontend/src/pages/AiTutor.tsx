import { useAuth, isAdministrator } from '@/auth/useAuth';

export default function AiTutor() {
    const { user } = useAuth();
    // AuthenticatedLayout only renders the h-16 header for admins (any width)
    // or on mobile; residents on desktop get no header, so there's nothing to
    // subtract there.
    const heightClass = isAdministrator(user)
        ? 'h-[calc(100vh-4rem)]'
        : 'h-[calc(100vh-4rem)] md:h-screen';

    return (
        <div className={`w-full ${heightClass}`}>
            <iframe
                sandbox="allow-same-origin allow-scripts allow-forms"
                className="w-full h-full border-0"
                src="/tutor"
                title="AI Tutor"
            />
        </div>
    );
}
