import PageNav from "../Components/PageNav";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import CourseContent from "../Components/CourseContent";
import { useAuth, AuthProvider } from "../AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <AuthProvider>
      <AuthenticatedLayout title="Dashboard">
        <PageNav user={user!} path={["Dashboard"]} />
        <CourseContent />
      </AuthenticatedLayout>
    </AuthProvider>
  );
}
