import * as React from 'react';

interface ULIComponentProps {
    tooltipClassName?: string; //for applying classes other than 'tooltip'
    iconClassName?: string; //for applying classes other than 'w-4 h-4'
    dataTip?: string;
    onClick?: (e?: React.MouseEvent) => void;
    onMouseDown?: () => void;
    icon: React.ForwardRefExoticComponent<
        React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
            title?: string;
            titleId?: string;
        } & React.RefAttributes<SVGSVGElement>
    >;
}

export default function ULIComponent(props: ULIComponentProps) {
    // Case 1: an icon with tooltipClassName 'w-4 h-4 self-start cursor-pointer'
    // Case 2: an icon that needs the default width overridden with a prop value: this will be applied to the className as well
    // Case 3: an icon without 'self-start cursor-pointer'

    return (
        <div
            className={`tooltip ${props.tooltipClassName ?? ''}`}
            data-tip={props.dataTip}
        >
            <props.icon
                className={`w-4 h-4 ${props.iconClassName ?? ''}`}
                onClick={props.onClick}
                onMouseDown={props.onMouseDown}
            />
        </div>
    );
}
