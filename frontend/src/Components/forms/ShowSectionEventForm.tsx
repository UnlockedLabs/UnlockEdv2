import { CloseX } from '../inputs';
import { Event } from '@/common';

export interface SectionEventProps {
    events: Event[];
    onClose: () => void;
}

export default function ShowEventsForDateModal({
    events,
    onClose
}: SectionEventProps) {
    const parseDuration = (duration: number): string => {
        const hours = Math.floor(duration / 3.6e12);
        const minutes = Math.floor((duration % 3.6e12) / 6e10);
        return `${hours}h ${minutes}m`;
    };

    if (events.length === 0) return null;

    return (
        <div>
            <div className="flex justify-end">
                <CloseX close={onClose} />
            </div>
            <h2 className="text-lg font-bold mb-4">Events</h2>

            <div className="flex flex-col space-y-4">
                {events.map((event: Event, idx: number) => (
                    <div
                        key={idx}
                        className="card shadow-lg border p-4 rounded-lg"
                    >
                        <h3 className="card-title text-lg font-semibold">
                            {event.program_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {event.is_cancelled ? (
                                <span className="text-red-500">Cancelled</span>
                            ) : (
                                <span className="text-green-500">
                                    Scheduled
                                </span>
                            )}
                        </p>
                        <p className="text-sm">
                            <strong>Location:</strong> {event.location}
                        </p>
                        <p className="text-sm">
                            <strong>Start Time:</strong>{' '}
                            {new Date(event.start_time).toLocaleString()}
                        </p>
                        <p className="text-sm">
                            <strong>Duration:</strong>{' '}
                            {parseDuration(event.duration)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
