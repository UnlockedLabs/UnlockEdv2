import { MessageSquarePlus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';

interface Note {
    id: number;
    date: string;
    admin: string;
    note: string;
}

interface HistoricalNotesProps {
    notes: Note[];
    isDeactivated: boolean;
    onAddNote: () => void;
}

export function HistoricalNotes({
    notes,
    isDeactivated,
    onAddNote
}: HistoricalNotesProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#203622]">
                    Historical Notes
                </h2>
                {!isDeactivated && (
                    <Button variant="outline" size="sm" onClick={onAddNote}>
                        <MessageSquarePlus className="size-4 mr-2" />
                        Add Note
                    </Button>
                )}
            </div>
            {notes.length === 0 ? (
                <p className="text-sm text-gray-500">No historical notes</p>
            ) : (
                <div className="space-y-4">
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            className="border-l-4 border-blue-300 pl-4 py-2"
                        >
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <FileText className="size-4" />
                                <span className="font-medium">
                                    {note.admin}
                                </span>
                                <span>&#183;</span>
                                <span>{formatDate(note.date)}</span>
                            </div>
                            <p className="text-sm text-gray-700">
                                {note.note}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
