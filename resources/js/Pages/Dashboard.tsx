import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";
import CourseContent from "@/Components/CourseContent";

export default function Dashboard({ auth }: PageProps) {
    return (
        <AuthenticatedLayout user={auth.user} title="Dashboard">
            <PageNav user={auth.user} path={["Dashboard"]} />
            <CourseContent />
        </AuthenticatedLayout>
    );
}
