import ApplicationLogo from "../Components/ApplicationLogo";
import { PropsWithChildren } from "react";

export default function Guest({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-background">
      <div>
        <a href="/">
          <ApplicationLogo className="w-20 h-20 fill-current text-slate-500" />
        </a>
      </div>

      <div className="w-full sm:max-w-md mt-6 px-6 py-4 bg-inner-background shadow-md overflow-hidden sm:rounded-lg">
        {children}
      </div>
    </div>
  );
}
