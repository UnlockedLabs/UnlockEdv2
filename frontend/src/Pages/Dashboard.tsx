import { useAuth } from '@/useAuth';
import { BROWSER_URL, UserRole } from '@/common';
import Loading from '@/Components/Loading';

export default function Dashboard() {
    const { user } = useAuth();

    // this is simply a backup route in case we need to direct the user to dashboard without knowing their role
    // prefer to use /admin-dashboard or /student-dashboard
    if (user?.role === UserRole.Admin) {
        window.location.href = '/admin-dashboard';
    } else if (user?.role === UserRole.Student) {
        window.location.href = '/student-dashboard';
    } else if (!user) {
        window.location.href = BROWSER_URL;
    }
    return (
        <div>
            <Loading />
        </div>
    );
}
