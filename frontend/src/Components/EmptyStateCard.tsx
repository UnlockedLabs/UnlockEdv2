import { PlusCircleIcon } from '@heroicons/react/24/outline';

interface EmptyStateCardProps {
    title: string;
    tooltipText: string;
    onActionButtonText?: string;
    onActionButtonClick?: () => void;
}

export default function EmptyStateCard(props: EmptyStateCardProps) {
    return (
        <div className="justify-items-center p-6">
            <p className="text-grey-2 text-base text-center p-10 mb-1">
                {props.title}
            </p>
            {props.onActionButtonText && props.onActionButtonClick && (
                <div className="tooltip tooltip-center">
                    <button
                        disabled={false}
                        className={`button button-sm flex items-center space-x-1 p-2 ${props.tooltipText ? 'tooltip tooltip-bottom' : ''}`}
                        data-tip={props.tooltipText}
                        onClick={props.onActionButtonClick}
                    >
                        <PlusCircleIcon className="w-4 my-auto" />
                        <span>{props.onActionButtonText}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
