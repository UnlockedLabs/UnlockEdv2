import { PropsWithChildren } from 'react';
import Navbar from '@/Components/Navbar';

export default function AuthenticatedLayout({
    title,
    children
}: PropsWithChildren<{ title: string }>) {
    return (
        <div className="font-lato">
            <div title={title} />
            <div className="flex">
                <Navbar />
                <div className="min-w-px bg-grey-1"></div>
                <main className="w-full min-h-screen bg-background">
                    {children}
                </main>
            </div>
        </div>
    );
}
