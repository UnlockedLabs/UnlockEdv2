import { useAuth } from "@/AuthContext";
import PageNav from "@/Components/PageNav";
import UserActivityMap from "@/Components/UserActivityMap";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

export default function MyProgress() {
  const auth = useAuth();

  return (
    <AuthenticatedLayout title="My Progress">
      <PageNav user={auth.user} path={["My Progreee"]} />
      <div className="px-8 py-4">
        <h1>My Progress</h1>
        <div className="m-4">
          <UserActivityMap user={auth.user} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
