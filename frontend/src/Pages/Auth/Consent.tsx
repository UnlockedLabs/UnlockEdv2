import ConsentForm from '@/Components/forms/ConsentForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Consent() {
    return (
        <AuthenticatedLayout title="External Login Consent" path={['consent']}>
            <ConsentForm />
        </AuthenticatedLayout>
    );
}
