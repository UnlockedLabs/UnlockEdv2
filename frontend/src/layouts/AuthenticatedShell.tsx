import { AuthProvider } from '@/auth/AuthProvider';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { Toaster } from '@/components/ui/sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

/**
 * Single shared shell for all authenticated routes. Mounted once at the router
 * root so the nav bar (and AuthProvider/context providers) persist across
 * navigation between authenticated pages — only the <Outlet/> content swaps.
 */
export default function AuthenticatedShell() {
    return (
        <AuthProvider>
            <PageTitleProvider>
                <BreadcrumbProvider>
                    <AuthenticatedLayout />
                </BreadcrumbProvider>
            </PageTitleProvider>
            <Toaster position="bottom-right" />
        </AuthProvider>
    );
}
