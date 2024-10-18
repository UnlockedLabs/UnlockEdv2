import { useAuth } from '@/useAuth';
import { UserRole } from '@/common';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
    const { user } = useAuth();
    if (!user) {
        return;
    }
    return (
        <div>
            {user.role === UserRole.Student ? (
                <StudentDashboard />
            ) : (
                <AdminDashboard />
            )}
        </div>
    );
}
