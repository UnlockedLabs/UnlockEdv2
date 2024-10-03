import * as React from 'react';

type ULIComponentProps = {
    outerDivClassName?: string; //for applying classes other than 'tooltip'
    innerDivClassName?: string; //for applying classes other than 'w-4 h-4'
    dataTip?: string;
    onClick?: () => void;
    onMouseDown?: () => void;
    icon: React.ForwardRefExoticComponent<
        React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
            title?: string;
            titleId?: string;
        } & React.RefAttributes<SVGSVGElement>
    >;
};

export default function ULIComponent(props: ULIComponentProps) {
    // TODO:
    // Case 1: a icon with outerDivClassName 'w-4 h-4 self-start cursor-pointer'
    // Case 2: an icon that needs the default width overridden with a prop value: this will be applied to the className as well
    // Case 3: an icon without 'self-start cursor-pointer'

    return (
        <div
            className={`tooltip ${props.outerDivClassName}`}
            data-tip={props.dataTip}
        >
            <props.icon
                className={`w-4 h-4 ${props.innerDivClassName}`}
                onClick={props.onClick}
                onMouseDown={props.onMouseDown}
            />
        </div>
    );
}
