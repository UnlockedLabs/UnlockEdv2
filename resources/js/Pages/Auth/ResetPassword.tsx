import ChangePasswordForm from "@/Components/forms/ChangePasswordForm";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head } from "@inertiajs/react";

export default function ResetPassword() {
    return (
        <GuestLayout>
            <Head title="Reset Password" />
            <ChangePasswordForm />
        </GuestLayout>
    );
}
