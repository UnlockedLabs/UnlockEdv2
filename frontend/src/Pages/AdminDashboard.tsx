import StatsCard from "@/Components/StatsCard"

export default function AdminDashboard(){
    const prisonName = "Potosi Correctional Facility"
    return(
        <div className="px-8 py-4">
            <h1 className="text-5xl">{prisonName}</h1>
            <div className="flex flex-row mt-12 gap-12">
                <div className="flex flex-col gap-6">
                    <div className="card min-h-[240px]">
                        <h2 className="card-h-padding">Overall Platform Engagement</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <StatsCard title={"ACTIVE USERS"} number={"109"} label={"students"} />
                        <StatsCard title={"AVG DAILY ACTIVITY"} number={"2"} label={"hours"} />
                        <StatsCard title={"TOTAL WEEK ACTIVITY"} number={"37"} label={"hours"} />
                    </div>
                    <div className="card min-h-[368px]">
                        <h2 className="card-h-padding">This Week's Milestone Completion Per Course</h2>
                    </div>
                </div>
                {/* Top course engagement */}
                <div className="card h-100 w-[35%]">
                    <h2 className="card-h-padding">Top Course Engagement</h2>
                </div>
            </div>
        </div>
    )
}