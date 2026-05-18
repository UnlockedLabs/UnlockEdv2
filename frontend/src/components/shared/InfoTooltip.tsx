import { ReactNode } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
    children: ReactNode;
    iconClassName?: string;
    className?: string;
}

export function InfoTooltip({
    children,
    iconClassName,
    className
}: InfoTooltipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={className}
                    aria-label="More information"
                >
                    <InformationCircleIcon
                        className={cn(
                            'size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                            iconClassName
                        )}
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-900 text-white max-w-xs">
                {children}
            </TooltipContent>
        </Tooltip>
    );
}
