import "@/bootstrap";
import "@/css/tailwind.css";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import Welcome from "@/Pages/Welcome";
import Dashboard from "@/Pages/Dashboard";
import Login from "@/Pages/Auth/Login";
import { User } from "types";
import Users from "@/Pages/Users";
import LeftMenuManagement from "@/Pages/LeftMenuManagement";
import UserActivity from "@/Pages/UserActivity";
import ResetPassword from "@/Pages/Auth/ResetPassword";

export default function App() {

  const requireAuth = async () => {
    try {
      const response = await window.axios.get("/api/auth");
      if (response.data['data'] === null) {
        return { element: <Navigate to="/login" replace /> };
      }
      return response.data['data'] as User
    } catch (error) {
      return { element: <Navigate to="/login" replace /> };
    }
  };

  const router = createBrowserRouter([
    {
      path: "/",
      loader: async () => {
        const auth = await requireAuth();
        return auth;
      },
      element: <Welcome />,
    },
    {
      path: "/login",
      loader: () => import("./Pages/Auth/Login"),
      element: <Login />,
    },
    {
      path: "/dashboard",
      loader: () => import("./Pages/Dashboard"),
      element: <Dashboard />,
    },
    {
      path: "/users",
      loader: () => import("./Pages/Users"),
      element: <Users />,
    },
    {
      path: "/left-menu-management",
      loader: () => import("./Pages/LeftMenuManagement"),
      element: <LeftMenuManagement />,
    },
    {
      path: "/user-activity",
      loader: () => import("./Pages/UserActivity"),
      element: <UserActivity />,
    },
    {
      path: "/reset-password",
      loader: () => import("./Pages/Auth/ResetPassword"),
      element: <ResetPassword />,
    },
  ]);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => router.dispose());
  }
  return (<RouterProvider router={router} fallbackElement={<p>Loading...</p>} />);
}

