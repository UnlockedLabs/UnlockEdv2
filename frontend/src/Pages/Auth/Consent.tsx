import ConsentForm from '@/Components/forms/ConsentForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Consent() {
    return (
        <div title="Application Consent">
            <AuthenticatedLayout title="External Login Consent">
                <ConsentForm />
            </AuthenticatedLayout>
        </div>
    );
}
