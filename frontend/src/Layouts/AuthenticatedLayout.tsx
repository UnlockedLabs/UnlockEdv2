import { PropsWithChildren } from "react";
import Navbar from "@/Components/Navbar";

export default function AuthenticatedLayout({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="font-lato">
      <div title={title} />
      <div className="flex">
        <Navbar/>
        <div className="w-0.5 bg-grey-1"></div>
        <main className="w-full min-h-screen bg-background px-4">{children}</main>
      </div>
    </div>
  );
}
