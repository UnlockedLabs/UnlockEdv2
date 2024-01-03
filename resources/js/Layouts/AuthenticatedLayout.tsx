import { PropsWithChildren } from "react";
import { User } from "@/types";
import { Head } from "@inertiajs/react";
import LeftMenu from "@/Components/LeftMenu";

export default function Authenticated({
    user,
    title,
    children,
}: PropsWithChildren<{ user: User; title: string }>) {
    return (
        <div>
            <Head title={title} />
            <div className="flex">
                <LeftMenu />
                <main className="w-full min-h-screen bg-base-100 px-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
