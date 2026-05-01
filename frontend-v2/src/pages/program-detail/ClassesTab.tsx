import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { Class } from '@/types';
import { getClassSchedule, getStatusColor } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function ClassRow({
    cls,
    onClick,
    className
}: {
    cls: Class;
    onClick: () => void;
    className?: string;
}) {
    const schedule = getClassSchedule(cls);
    const enrollmentPercent =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    const scheduleText = schedule.days.length
        ? `${schedule.days.join(', ')}${
              schedule.startTime
                  ? ` | ${schedule.startTime}${
                        schedule.endTime ? ` - ${schedule.endTime}` : ''
                    }`
                  : ''
          }`
        : '';

    return (
        <div
            onClick={onClick}
            className={`p-6 hover:bg-[#E2E7EA]/50 cursor-pointer transition-colors ${className ?? ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-[#203622] hover:text-[#556830] transition-colors">
                            {cls.name}
                        </h4>
                        <Badge
                            variant="outline"
                            className={getStatusColor(cls.status)}
                        >
                            {cls.status}
                        </Badge>
                    </div>
                    {cls.description && (
                        <p className="text-sm text-gray-600 mb-3">
                            {cls.description}
                        </p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                        <span>{cls.instructor_name}</span>
                        {scheduleText && <span>{scheduleText}</span>}
                        {schedule.room && <span>{schedule.room}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Attendance:</span>
                        <span className="font-medium text-[#556830]">--</span>
                    </div>
                </div>
                <div className="ml-6 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                            Enrollment
                        </span>
                        <span className="text-sm text-[#203622]">
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
    const activeScheduledClasses = programClasses.filter(
        (cls) => cls.status === 'Active' || cls.status === 'Scheduled'
    );
    const completedClasses = programClasses.filter(
        (cls) => cls.status === 'Completed'
    );
    const cancelledClasses = programClasses.filter(
        (cls) => cls.status === 'Cancelled'
    );
    const pausedClasses = programClasses.filter(
        (cls) => cls.status === 'Paused'
    );

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-[#203622]">Classes</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        All classes offered under this program
                    </p>
                </div>
                <Button
                    onClick={() =>
                        navigate('/programs/' + programId + '/classes')
                    }
                    className="bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622] gap-2"
                >
                    <Plus className="size-5" />
                    Create New Class
                </Button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
                {programClasses.length > 0 ? (
                    <div>
                        {activeScheduledClasses.length > 0 && (
                            <div className="divide-y divide-gray-200">
                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                    <h3 className="text-sm font-medium text-gray-700">
                                        Active &amp; Scheduled Classes (
                                        {activeScheduledClasses.length}
                                        )
                                    </h3>
                                </div>
                                {activeScheduledClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        onClick={() =>
                                            navigate(
                                                '/program-classes/' +
                                                    cls.id +
                                                    '/detail'
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}

                        {completedClasses.length > 0 && (
                            <div className="divide-y divide-gray-200">
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                    <h3 className="text-sm font-medium text-gray-700">
                                        Completed Classes (
                                        {completedClasses.length}
                                        )
                                    </h3>
                                </div>
                                {completedClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        onClick={() =>
                                            navigate(
                                                '/program-classes/' +
                                                    cls.id +
                                                    '/detail'
                                            )
                                        }
                                        className="bg-gray-50/50 hover:bg-gray-100"
                                    />
                                ))}
                            </div>
                        )}

                        {cancelledClasses.length > 0 && (
                            <div className="divide-y divide-gray-200">
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                    <h3 className="text-sm font-medium text-gray-700">
                                        Cancelled Classes (
                                        {cancelledClasses.length}
                                        )
                                    </h3>
                                </div>
                                {cancelledClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        onClick={() =>
                                            navigate(
                                                '/program-classes/' +
                                                    cls.id +
                                                    '/detail'
                                            )
                                        }
                                        className="bg-gray-50/50 hover:bg-gray-100"
                                    />
                                ))}
                            </div>
                        )}

                        {pausedClasses.length > 0 && (
                            <div className="divide-y divide-gray-200">
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                    <h3 className="text-sm font-medium text-gray-700">
                                        Paused Classes (
                                        {pausedClasses.length}
                                        )
                                    </h3>
                                </div>
                                {pausedClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        onClick={() =>
                                            navigate(
                                                '/program-classes/' +
                                                    cls.id +
                                                    '/detail'
                                            )
                                        }
                                        className="bg-gray-50/50 hover:bg-gray-100"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        <BookOpen className="size-12 mx-auto mb-3 text-gray-300" />
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
