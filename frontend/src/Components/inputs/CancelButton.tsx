export function CancelButton({
    label = 'Cancel',
    disabled = false,
    onClick
}: {
    label?: string;
    disabled?: boolean;
    onClick: (e: React.MouseEvent) => void;
}) {
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick(e);
    };

    return (
        <input
            disabled={disabled}
            type="button"
            className="button-grey"
            onClick={handleClick}
            value={label}
        />
    );
}
