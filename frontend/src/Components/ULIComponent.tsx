import * as React from 'react';

type ULIComponentProps = {
    className: string;
    tooltip: string;
    onClick: () => void;
    icon: React.ForwardRefExoticComponent<
        React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
            title?: string;
            titleId?: string;
        } & React.RefAttributes<SVGSVGElement>
    >;
};

export default function ULIComponent(props: ULIComponentProps) {
    return (
        <div className="tooltip" data-tip={props.tooltip}>
            <props.icon className={props.className} onClick={props.onClick} />
        </div>
    );
}
