import LoginForm from "@/Components/forms/LoginForm";
import GuestLayout from "@/Layouts/GuestLayout";
import { Head } from "@inertiajs/react";

export default function Login({ status }: { status?: string }) {
    return (
        <GuestLayout>
            <Head title="Log in" />
            {status && (
                <div className="mb-4 font-medium text-sm text-green-600">
                    {status}
                </div>
            )}
            <LoginForm />
        </GuestLayout>
    );
}
