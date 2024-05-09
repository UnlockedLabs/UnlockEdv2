export default function ProgressBar({percent} : {percent:number}){
    return(
        <div className="flex flex-row gap-2 justify-between">
            <progress className="progress progress-primary my-auto" value={percent} max="100"></progress>
            <div className="body-small min-w-[40px]">{percent} %</div>
        </div>
    )
}