export default function Brand() {
    return (
        <div className="flex flex-col justify-between items-center space-x-2">
            <img className="h-12" src="/ul-logo.png" />
            <h1 className="text-2xl">
                <span className="text-primary">Unlock</span>
                <span className="text-secondary">Ed</span>
                <span className="text-base">v2</span>
            </h1>
        </div>
    );
}
