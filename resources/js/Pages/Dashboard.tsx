import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";

export default function Dashboard({ auth }: PageProps) {
    return (
        <AuthenticatedLayout user={auth.user} title="Dashboard">
            <h1 className="font-semibold text-2xl">Dashboard</h1>
        </AuthenticatedLayout>
    );
}
