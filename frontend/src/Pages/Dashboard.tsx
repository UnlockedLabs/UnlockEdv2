import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { useAuth } from "@/AuthContext";
import { UserRole } from "@/common";
import StudentDashboard from "./StudentDashboard";
import AdminDashboard from "./AdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AuthenticatedLayout title="Dashboard">
      <PageNav user={user} path={["Dashboard"]} />
      {user.role==UserRole.Student ? <StudentDashboard /> : <AdminDashboard /> }
    </AuthenticatedLayout>
  );
}
