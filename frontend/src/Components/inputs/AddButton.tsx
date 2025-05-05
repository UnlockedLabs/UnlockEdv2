import { PlusCircleIcon } from '@heroicons/react/24/outline';

export function AddButton({
    label = 'Add',
    onClick,
    disabled = false
}: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            disabled={disabled}
            className="button flex items-center space-x-1"
            onClick={onClick}
        >
            <PlusCircleIcon className="w-4 my-auto" />
            <span>{label}</span>
        </button>
    );
}
