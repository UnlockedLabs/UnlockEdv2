export default function Brand() {
    return (
        <div className="flex flex-col justify-between items-center space-x-2">
            <img
                className="h-24 logo-dark"
                src="/ul-logo-stacked-med-w.svg"
                alt="UnlockEd brand logo"
            />
            <img
                className="h-24 logo-light"
                src="/ul-logo-stacked-med-d.svg"
                alt="UnlockEd brand logo"
            />
        </div>
    );
}
