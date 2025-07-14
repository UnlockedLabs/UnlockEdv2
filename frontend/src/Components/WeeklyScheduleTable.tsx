import { StudentCalendar } from '@/types/events';

const timeGroups = [
    { label: 'Morning (6am - 12pm)', start: 6, end: 12 },
    { label: 'Afternoon (12pm - 6pm)', start: 12, end: 18 },
    { label: 'Evening (6pm - 10pm)', start: 18, end: 22 }
];

// Map JS getDay() index (0=Sunday) to header order Monday (1) -> Sunday (0)
const dayOrder = [1, 2, 3, 4, 5, 6, 0];
const dayNames: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday'
};

interface Props {
    days: StudentCalendar[];
}

export default function WeeklyScheduleTable({ days }: Props) {
    // Build a map from day index (0=Sunday) to DayData
    const dayMap: Record<number, StudentCalendar> = {};
    days.forEach((d) => {
        const dt = new Date(d.date);
        const weekday = dt.getDay();
        dayMap[weekday] = d;
    });

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full table-auto border">
                <thead className="">
                    <tr>
                        <th className="border px-4 py-2"></th>
                        {dayOrder.map((dayIdx) => (
                            <th
                                key={dayIdx}
                                className="border px-4 py-2 text-left"
                            >
                                {dayNames[dayIdx]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {timeGroups.map((group) => (
                        <tr key={group.label} className="">
                            <td className="border px-4 py-2 font-semibold">
                                {group.label}
                            </td>
                            {dayOrder.map((dayIdx) => {
                                const dayData = dayMap[dayIdx];
                                const events =
                                    dayData?.events.filter((ev) => {
                                        const localHour = new Date(
                                            ev.start_time
                                        ).getHours();
                                        return (
                                            localHour >= group.start &&
                                            localHour < group.end
                                        );
                                    }) || [];
                                return (
                                    <td
                                        key={dayIdx}
                                        className="border px-4 py-2 align-top"
                                    >
                                        {events.length > 0 ? (
                                            <ul className="space-y-1">
                                                {events.map((ev) => (
                                                    <li
                                                        key={ev.event_id}
                                                        className="p-1 rounded-lg"
                                                    >
                                                        <div className="text-sm font-medium">
                                                            {ev.program_name}
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {new Date(
                                                                ev.start_time
                                                            ).toLocaleTimeString(
                                                                [],
                                                                {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                }
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-gray-400 text-sm">
                                                —
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
