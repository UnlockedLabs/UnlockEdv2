export function CancelButton({
    label = 'Cancel',
    onClick
}: {
    label?: string;
    onClick: () => void;
}) {
    return (
        <input
            type="button"
            className="button-grey"
            onClick={onClick}
            value={label}
        />
    );
}
