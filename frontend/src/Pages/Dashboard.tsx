import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useAuth } from '@/useAuth';
import { UserRole } from '@/common';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
    const { user } = useAuth();

    return (
        <AuthenticatedLayout title="Dashboard" path={['Dashboard']}>
            {user.role == UserRole.Student ? (
                <StudentDashboard />
            ) : (
                <AdminDashboard />
            )}
        </AuthenticatedLayout>
    );
}
