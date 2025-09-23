import { PlusCircleIcon } from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';

interface EmptyStateCardProps {
    title: string;
    tooltipText: string;
    onActionButtonText?: string;
    onActionButtonClick?: () => void;
    actionButtonDisabled?: boolean;
}

export default function EmptyStateCard(props: EmptyStateCardProps) {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 p-10">
            <p className="text-grey-3 text-base">{props.title}</p>
            {props.onActionButtonText && props.onActionButtonClick && (
                <button
                    disabled={props.actionButtonDisabled}
                    className={`button button-sm ${props.tooltipText ? 'tooltip tooltip-bottom' : ''}`}
                    data-tip={props.tooltipText}
                    onClick={props.onActionButtonClick}
                >
                    <ULIComponent icon={PlusCircleIcon} />
                    <span>{props.onActionButtonText}</span>
                </button>
            )}
        </div>
    );
}
