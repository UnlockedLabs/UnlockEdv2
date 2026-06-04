import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FacilityProgramClassEvent } from '@/types';

interface CanvasEventSheetProps {
    event: FacilityProgramClassEvent;
    onClose: () => void;
}

export function CanvasEventSheet({ event, onClose }: CanvasEventSheetProps) {
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end instanceof Date ? event.end : new Date(event.end);

    const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    return (
        <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent>
                <SheetHeader>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded px-2 py-0.5">Canvas</span>
                    </div>
                    <SheetTitle>{event.title}</SheetTitle>
                    <SheetDescription>{event.program_name}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <div>
                        <span className="font-medium">Date: </span>{dateStr}
                    </div>
                    <div>
                        <span className="font-medium">Time: </span>{timeStr}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
