export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" className="button-grey" onClick={onClick}>
            Cancel
        </button>
    );
}
