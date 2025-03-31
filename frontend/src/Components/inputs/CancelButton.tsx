export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <input type="button" className="btn" onClick={onClick} value="Cancel" />
    );
}
