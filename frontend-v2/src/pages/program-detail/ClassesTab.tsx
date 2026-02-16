import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { Class } from '@/types';
import { getClassSchedule, getStatusColor } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function ClassRow({ cls, onClick }: { cls: Class; onClick: () => void }) {
    const schedule = getClassSchedule(cls);
    const enrollmentPercent =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    return (
        <div
            onClick={onClick}
            className="p-6 hover:bg-muted/50 cursor-pointer transition-colors"
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-foreground hover:text-[#556830] transition-colors">
                            {cls.name}
                        </h4>
                        <Badge
                            variant="outline"
                            className={getStatusColor(cls.status)}
                        >
                            {cls.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span>{cls.instructor_name}</span>
                        {schedule.days.length > 0 && (
                            <span>
                                {schedule.days.join(', ')}
                                {schedule.startTime &&
                                    ` | ${schedule.startTime}`}
                                {schedule.endTime && ` - ${schedule.endTime}`}
                            </span>
                        )}
                        {schedule.room && <span>{schedule.room}</span>}
                    </div>
                </div>
                <div className="ml-6 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                            Enrollment
                        </span>
                        <span className="text-sm text-foreground">
                            {cls.enrolled} / {cls.capacity}
                        </span>
                    </div>
                    <Progress
                        value={enrollmentPercent}
                        className="h-2"
                        indicatorClassName="bg-[#556830]"
                    />
                </div>
            </div>
        </div>
    );
}

export default function ClassesTab({
    programId,
    programClasses,
    navigate
}: {
    programId: string;
    programClasses: Class[];
    navigate: ReturnType<typeof useNavigate>;
}) {
    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-foreground">Classes</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        All classes offered under this program
                    </p>
                </div>
                <Button
                    onClick={() =>
                        navigate('/programs/' + programId + '/classes')
                    }
                    className="bg-[#F1B51C] hover:bg-[#d9a419] text-foreground gap-2"
                >
                    <Plus className="size-5" />
                    Add Class
                </Button>
            </div>

            <div className="bg-card rounded-lg border border-border">
                {programClasses.length > 0 ? (
                    <div className="divide-y divide-border">
                        {programClasses.map((cls) => (
                            <ClassRow
                                key={cls.id}
                                cls={cls}
                                onClick={() =>
                                    navigate(
                                        '/program-classes/' +
                                            cls.id +
                                            '/dashboard'
                                    )
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-muted-foreground">
                        <BookOpen className="size-12 mx-auto mb-3 text-muted-foreground" />
                        <p>No classes yet</p>
                        <p className="text-sm mt-1">
                            Create the first class for this program
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
