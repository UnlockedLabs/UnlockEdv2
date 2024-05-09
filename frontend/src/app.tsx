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
import { AuthProvider } from "./AuthContext";
import Consent from "./Pages/Auth/Consent";
import MyCourses from "./Pages/MyCourses";
import MyProgress from "./Pages/MyProgress";

function WithAuth({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

export default function App() {
  const router = createBrowserRouter([
    { path: "/", element: <Welcome /> },
    { path: "/login", element: <Login /> },
    { path: "/dashboard", element: WithAuth({ children: <Dashboard /> }) },
    { path: "/users", element: WithAuth({ children: <Users /> }) },
    {
      path: "/left-menu-management",
      element: WithAuth({ children: <LeftMenuManagement /> }),
    },
    {
      path: "/user-activity",
      element: WithAuth({ children: <UserActivity /> }),
    },
    {
      path: "/reset-password",
      element: WithAuth({ children: <ResetPassword /> }),
    },
    {
      path: "/consent",
      element: WithAuth({ children: <Consent /> }),
    },
    {
      path: "/provider-platform-management",
      element: WithAuth({ children: <ProviderPlatformManagement /> }),
    },
    {
      path: "/my-courses",
      element: WithAuth({ children: <MyCourses /> }),
    },
    {
      path: "/my-progress",
      element: WithAuth({ children: <MyProgress /> }),
    },
  ]);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => router.dispose());
  }

  return <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />;
}
