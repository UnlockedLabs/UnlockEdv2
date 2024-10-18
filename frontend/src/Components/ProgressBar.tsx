export default function ProgressBar({ percent }: { percent: number }) {
    return (
        <div className="flex flex-row gap-2 justify-between">
            <progress
                className="progress progress-primary my-auto flex-grow"
                value={percent}
                max="100"
            ></progress>
            <span className="text-sm text-nowrap">{percent} %</span>
        </div>
    );
}
