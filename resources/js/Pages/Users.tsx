import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";

export default function Users({ auth }: PageProps) {
    return (
        <AuthenticatedLayout user={auth.user} title="Users">
            <h1 className="font-semibold text-2xl">Users</h1>
        </AuthenticatedLayout>
    );
}
