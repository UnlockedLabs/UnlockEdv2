export function DeleteButton({ onClick }: { onClick: () => void }) {
    return (
        <button className="btn btn-error" onClick={onClick}>
            Delete
        </button>
    );
}
