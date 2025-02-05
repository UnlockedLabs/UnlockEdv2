export function ConfirmButton({ onClick }: { onClick: () => void }) {
    return (
        <button className="btn btn-primary" onClick={onClick}>
            Confirm
        </button>
    );
}
