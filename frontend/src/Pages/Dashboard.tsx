import PageNav from "../Components/PageNav";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import CourseContent from "../Components/CourseContent";
import { useAuth } from "../AuthContext";

export default function Dashboard() {
  const auth = useAuth();
  return (
    <AuthenticatedLayout title="Dashboard">
      <PageNav user={auth!} path={["Dashboard"]} />
      <CourseContent />
    </AuthenticatedLayout>
  );
}
