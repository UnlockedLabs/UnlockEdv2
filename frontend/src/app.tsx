import {
    KnowledgeCenterAdminRoutes,
    KnowledgeCenterRoutes
} from './Routes/KnowledgeCenterRoutes.tsx';
import { ProviderPlatformRoutes } from './Routes/ProviderRoutes.tsx';
import { AdminRoutes, NonAdminRoutes } from './Routes/App.tsx';
import { AdminProgramRoutes } from './Routes/Programs.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Loading from './Components/Loading.tsx';

const router = createBrowserRouter([
    NonAdminRoutes,
    AdminRoutes,
    KnowledgeCenterRoutes,
    KnowledgeCenterAdminRoutes,
    ProviderPlatformRoutes,
    AdminProgramRoutes
]);

export default function App() {
    if (import.meta.hot) {
        import.meta.hot.dispose(() => router.dispose());
    }

    return <RouterProvider router={router} fallbackElement={<Loading />} />;
}
