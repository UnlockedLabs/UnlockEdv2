import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CourseCatalogResponse, PillTagType, OutcomePillType, ViewType } from '@/types';

function getEnrollmentBadge(courseType: string) {
    const type = courseType as PillTagType;
    if (type === PillTagType.Open)
        return { label: 'Open Enrollment', className: 'bg-green-100 text-green-700 border-green-200' };
    if (type === PillTagType.SelfPaced)
        return { label: 'Self-Paced', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Permission Only', className: 'bg-red-100 text-red-700 border-red-200' };
}

function getOutcomeBadges(outcomeTypes: string) {
    if (!outcomeTypes) return [];
    return outcomeTypes
        .split(',')
        .filter((o) => Object.values(OutcomePillType).includes(o as OutcomePillType))
        .map((o) => {
            const outcome = o as OutcomePillType;
            return outcome === OutcomePillType.Certificate
                ? 'Certificate Granting'
                : outcome === OutcomePillType.CollegeCredit
                  ? 'College Credit'
                  : '';
        })
        .filter(Boolean);
}

function formatDateRange(startDt?: Date, endDt?: Date): string {
    const fmt = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    const start = startDt ? fmt(startDt) : '';
    const end = endDt ? fmt(endDt) : '';
    if (!start && !end) return '';
    return ` | ${start} - ${end}`;
}

interface CatalogCourseCardProps {
    course: CourseCatalogResponse;
    view?: ViewType;
}

export default function CatalogCourseCard({ course, view }: CatalogCourseCardProps) {
    const enrollment = getEnrollmentBadge(course.course_type);
    const outcomes = getOutcomeBadges(course.outcome_types);
    const dateStr = formatDateRange(course.start_dt, course.end_dt);

    if (view === ViewType.List) {
        return (
            <a
                href={course.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
            >
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4 px-5">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-medium text-foreground">
                                {course.course_name}
                            </h3>
                            <span className="text-muted-foreground">|</span>
                            <p className="text-sm text-muted-foreground">
                                {course.provider_name}
                                {dateStr}
                            </p>
                            <Badge
                                variant="outline"
                                className={enrollment.className}
                            >
                                {enrollment.label}
                            </Badge>
                            {outcomes.map((label) => (
                                <Badge
                                    key={label}
                                    variant="outline"
                                    className="bg-muted text-muted-foreground border-border"
                                >
                                    {label}
                                </Badge>
                            ))}
                        </div>
                        {course.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                {course.description}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </a>
        );
    }

    return (
        <a
            href={course.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[124px] bg-muted">
                    {course.thumbnail_url ? (
                        <img
                            src={course.thumbnail_url}
                            alt={course.course_name}
                            className="object-contain w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted" />
                    )}
                </div>
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                        {course.course_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {course.provider_name}
                        {dateStr}
                    </p>
                    {course.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {course.description}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        <Badge
                            variant="outline"
                            className={enrollment.className}
                        >
                            {enrollment.label}
                        </Badge>
                        {outcomes.map((label) => (
                            <Badge
                                key={label}
                                variant="outline"
                                className="bg-muted text-muted-foreground border-border"
                            >
                                {label}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </a>
    );
}
