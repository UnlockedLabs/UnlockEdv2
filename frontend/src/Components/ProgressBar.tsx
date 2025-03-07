export default function ProgressBar({
    percent,
    showPercentage = true,
    numerator = 0,
    denominator = 100
}: {
    percent: number;
    showPercentage?: boolean;
    numerator?: number;
    denominator?: number;
}) {
    return (
        <div className="flex flex-row gap-2 justify-between">
            <progress
                className="progress progress-primary my-auto flex-grow"
                value={percent}
                max="100"
            ></progress>
            <span className="text-sm text-nowrap">
                {showPercentage
                    ? `${percent} %`
                    : `${numerator}/${denominator}`}
            </span>
        </div>
    );
}
