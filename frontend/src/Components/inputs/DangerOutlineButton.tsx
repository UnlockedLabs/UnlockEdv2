import { ReactElement } from 'react';

export interface DangerOutlineButtonProps {
    label?: string;
    onClick: () => void;
    icon: ReactElement;
    disabled?: boolean;
    dataTip?: string;
    className?: string;
}

export function DangerOutlineButton({
    label = 'Action',
    onClick,
    icon,
    disabled = false,
    dataTip,
    className = ''
}: DangerOutlineButtonProps) {
    return (
        <button
            disabled={disabled}
            className={`button flex items-center gap-2 text-red-3 border-2 border-red-3 bg-transparent hover:bg-red-1 disabled:opacity-50 disabled:cursor-not-allowed ${dataTip ? 'tooltip tooltip-left' : ''} ${className}`}
            {...(dataTip && { 'data-tip': dataTip })}
            onClick={onClick}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
