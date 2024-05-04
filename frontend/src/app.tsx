import "@/bootstrap";
import "@/css/app.css";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Welcome from "@/Pages/Welcome";
import Dashboard from "@/Pages/Dashboard";
import Login from "@/Pages/Auth/Login";
import Users from "@/Pages/Users";
import LeftMenuManagement from "@/Pages/LeftMenuManagement";
import UserActivity from "@/Pages/UserActivity";
import ResetPassword from "@/Pages/Auth/ResetPassword";
import ProviderPlatformManagement from "./Pages/ProviderPlatformManagement";


export default function App() {
  const router = createBrowserRouter([
    { path: "/", element: <Welcome /> },
    { path: "/login", element: <Login /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/users", element: <Users /> },
    { path: "/left-menu-management", element: <LeftMenuManagement /> },
    { path: "/user-activity", element: <UserActivity /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/provider-platform-management", element: <ProviderPlatformManagement /> },
  ]);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => router.dispose());
  }

  return (
    <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
  );
}
