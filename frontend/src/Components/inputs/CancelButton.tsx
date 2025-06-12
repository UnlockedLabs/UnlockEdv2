export function CancelButton({
    label = 'Cancel',
    disabled = false,
    onClick
}: {
    label?: string;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <input
            disabled={disabled}
            type="button"
            className="button-grey"
            onClick={onClick}
            value={label}
        />
    );
}
