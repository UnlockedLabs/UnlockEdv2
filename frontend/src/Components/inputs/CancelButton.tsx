export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" className="btn" onClick={onClick}>
            Cancel
        </button>
    );
}
