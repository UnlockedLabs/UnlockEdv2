import PageNav from "@/Components/PageNav";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";
import CourseContent from "@/Components/CourseContent";
import UserActivityMap from "@/Components/UserActivityMap";

export default function Dashboard({ auth }: PageProps) {
    return (
        <AuthenticatedLayout user={auth.user} title="Dashboard">
            <PageNav user={auth.user} path={["Dashboard"]} />
            <div className="m-4">
                <UserActivityMap user={auth.user} />
            </div>
            <CourseContent user={auth.user} />
        </AuthenticatedLayout>
    );
}
