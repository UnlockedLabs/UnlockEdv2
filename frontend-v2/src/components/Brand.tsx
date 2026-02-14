export default function Brand({ className }: { className?: string }) {
    return (
        <div className={className}>
            <img
                className="h-8 hidden dark:block"
                src="/ul-logo-w.svg"
                alt="UnlockEd"
            />
            <img
                className="h-8 block dark:hidden"
                src="/ul-logo-d.svg"
                alt="UnlockEd"
            />
        </div>
    );
}
