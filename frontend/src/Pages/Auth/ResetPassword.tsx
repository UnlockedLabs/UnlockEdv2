import ChangePasswordForm from '../../Components/forms/ChangePasswordForm';
import GuestLayout from '../..//Layouts/GuestLayout';

export default function ResetPassword() {
    return (
        <GuestLayout>
            <div title="Reset Password" />
            <ChangePasswordForm />
        </GuestLayout>
    );
}
