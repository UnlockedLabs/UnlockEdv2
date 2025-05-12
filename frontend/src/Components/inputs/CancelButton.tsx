export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <input
            type="button"
            className="button-grey"
            onClick={onClick}
            value="Cancel"
        />
    );
}
