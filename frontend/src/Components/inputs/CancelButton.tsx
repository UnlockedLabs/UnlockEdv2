export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <button className="btn" onClick={onClick}>
            Cancel
        </button>
    );
}
