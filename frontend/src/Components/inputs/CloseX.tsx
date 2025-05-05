export function CloseX({ close }: { close: () => void }) {
    return (
        <form method="dialog">
            <button
                className="button-circle absolute right-2 top-2"
                onClick={() => close()}
            >
                ✕
            </button>
        </form>
    );
}
