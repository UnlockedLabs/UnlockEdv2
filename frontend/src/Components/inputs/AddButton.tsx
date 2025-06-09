import { PlusCircleIcon } from '@heroicons/react/24/outline';

export function AddButton({
    label = 'Add',
    onClick,
    disabled = false,
    dataTip
}: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
    dataTip?: string;
}) {
    return (
        <button
            disabled={disabled}
            className={`button flex items-center space-x-1 ${dataTip ? 'tooltip tooltip-left' : ''}`}
            data-tip={dataTip}
            onClick={onClick}
        >
            <PlusCircleIcon className="w-4 my-auto" />
            <span>{label}</span>
        </button>
    );
}
