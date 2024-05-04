import LoginForm from "../../Components/forms/LoginForm";
import GuestLayout from "../../Layouts/GuestLayout";
export default function Login({ status }: { status?: string }) {
  return (
    <>
      <div title="Log in" />
      <GuestLayout>
        {status && (
          <div className="mb-4 font-medium text-sm text-green-600">
            {status}
          </div>
        )}
        <LoginForm />
      </GuestLayout>
    </>
  );
}
