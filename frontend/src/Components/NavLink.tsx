export interface NavLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export default function NavLink({
  active = false,
  className = "",
  children,
  ...props
}: NavLinkProps & { active: boolean }) {
  return (
    <div
      {...props}
      className={
        "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none " +
        (active
          ? "border-teal-400 dark:border-teal-600 text-slate-900 dark:text-slate-100 focus:border-teal-700 "
          : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 focus:text-slate-700 dark:focus:text-slate-300 focus:border-slate-300 dark:focus:border-slate-700 ") +
        className
      }
    >
      {children}
    </div>
  );
}
