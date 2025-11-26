export function WarningButton({
    action,
    onClick
}: {
    action: string;
    onClick: () => void;
}) {
    return (
        <button type="button" className="button-warning" onClick={onClick}>
            {action.charAt(0).toUpperCase() + action.slice(1)}
        </button>
    );
}
