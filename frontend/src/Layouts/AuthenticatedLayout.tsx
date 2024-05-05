import { PropsWithChildren } from "react";
import LeftMenu from "../Components/LeftMenu";

export default function AuthenticatedLayout({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="font-lato">
      <div title={title} />
      <div className="flex">
        <LeftMenu />
        <main className="w-full min-h-screen bg-base-100 px-4">{children}</main>
      </div>
    </div>
  );
}
