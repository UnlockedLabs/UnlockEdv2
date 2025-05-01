import { useAuth } from '@/useAuth';

export default function ResidentOverview() {
    const { user } = useAuth();

    return (
        <>
            <h1 className="p-5">Hello {user?.name_first}</h1>
        </>
    );
}
