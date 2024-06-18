import { useEffect } from "react";
import LoginForm from "../../Components/forms/LoginForm";
import GuestLayout from "../../Layouts/GuestLayout";
export default function Login({ status }: { status?: string }) {
  useEffect(() => {
    // if there is no ?flow= query parameter, redirect to /self-service/login/browser
    if (!window.location.search.includes("flow=")) {
      window.location.href = "/self-service/login/browser";
    }
  }, []);
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
