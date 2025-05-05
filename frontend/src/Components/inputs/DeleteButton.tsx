export function DeleteButton({ onClick }: { onClick: () => void }) {
    return (
        <button className="button-red" onClick={onClick}>
            Delete
        </button>
    );
}
