export function ConfirmButton({
    action,
    onClick
}: {
    action: string;
    onClick: () => void;
}) {
    return (
        <button className="button" onClick={onClick}>
            {action.charAt(0).toUpperCase() + action.slice(1)}
        </button>
    );
}
