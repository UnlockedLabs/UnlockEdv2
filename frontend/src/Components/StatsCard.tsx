import { InformationCircleIcon } from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';
interface StatsCardProps {
    title: string;
    number: string;
    label: string;
    tooltip?: string;
}
export default function StatsCard({
    title,
    number,
    label,
    tooltip
}: StatsCardProps) {
    const formatNumber = (num: string) => {
        return parseInt(num).toLocaleString('en-US');
    };

    return (
        <div className="card bg-base-teal p-4 pb-5 flex flex-col justify-between overflow-visible">
            <div className="flex items-center gap-1">
                <h3 className="text-teal-4 line-clamp-2">
                    {title.toUpperCase()}
                </h3>
                {tooltip && (
                    <ULIComponent
                        icon={InformationCircleIcon}
                        dataTip={tooltip}
                        iconClassName="text-teal-4 cursor-help h-5 w-5"
                    />
                )}
            </div>
            <p className="text-teal-3 text-4xl font-bold mt-4">
                {formatNumber(number)}
                <span className="text-teal-4 text-base font-bold ml-3">
                    {label[0].toUpperCase() + label.slice(1)}
                </span>
            </p>
        </div>
    );
}
