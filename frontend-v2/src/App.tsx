import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import Loading from '@/components/Loading';

export default function App() {
    if (import.meta.hot) {
        import.meta.hot.dispose(() => router.dispose());
    }

    return <RouterProvider router={router} fallbackElement={<Loading />} />;
}
