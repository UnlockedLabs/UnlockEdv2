import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import { ResidentProgramOverview } from '@/types';

interface CompletedProgramsProps {
    programs: ResidentProgramOverview[];
    onViewDetails: (program: ResidentProgramOverview) => void;
}

export function CompletedPrograms({
    programs,
    onViewDetails
}: CompletedProgramsProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#203622]">
                    Completed Programs & Achievements
                </h2>
                <Badge className="bg-[#556830] text-white border-[#556830]">
                    {programs.length} Completed
                </Badge>
            </div>
            {programs.length === 0 ? (
                <p className="text-sm text-gray-500">No completed programs</p>
            ) : (
                <div className="space-y-3">
                    {programs.map((program) => {
                        const present = program.present_attendance ?? 0;
                        const absent = program.absent_attendance ?? 0;
                        const total = present + absent;
                        const rate =
                            total > 0
                                ? Math.round((present / total) * 100)
                                : 0;

                        return (
                            <div
                                key={`${program.program_id}-${program.class_id}`}
                                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                            >
                                <CheckCircle2 className="size-6 text-green-700 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-[#203622]">
                                        {program.program_name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {program.class_name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Completed{' '}
                                        {formatDate(program.end_date)} -{' '}
                                        {present}/{total} sessions attended (
                                        {rate}%)
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewDetails(program)}
                                >
                                    View Details
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
