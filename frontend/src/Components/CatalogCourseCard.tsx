import LightGreenPill from './pill-labels/LightGreenPill';
import RedPill from './pill-labels/RedPill';
import YellowPill from './pill-labels/YellowPill';
import GreyPill from './pill-labels/GreyPill';
import {
    CourseCatalogue,
    OutcomePillType,
    PillTagType,
    ViewType
} from '@/common';

export default function CatalogCourseCard({
    course,
    view
}: {
    course: CourseCatalogue;
    view?: ViewType;
}) {
    const coverImage = course.thumbnail_url;
    const course_type: PillTagType = course.course_type as PillTagType;

    let coursePill: JSX.Element = <RedPill>Permission Only</RedPill>;
    if (course_type == PillTagType.Open)
        coursePill = <LightGreenPill>Open Enrollment</LightGreenPill>;
    if (course_type == PillTagType.Permission)
        coursePill = <RedPill>Permission Only</RedPill>;
    if (course_type == PillTagType.SelfPaced)
        coursePill = <YellowPill>Self-Paced</YellowPill>;

    const outcomeTypes: OutcomePillType[] = course.outcome_types
        .split(',')
        .map((outcome) => outcome as OutcomePillType)
        .filter((type) => Object.values(OutcomePillType).includes(type));
    const outcomePills = outcomeTypes.map((outcomeString: string) => {
        const outcome = outcomeString as OutcomePillType;
        console.log(outcome);
        const pillLabel =
            outcome == OutcomePillType.Certificate
                ? 'Certificate Granting'
                : outcome == OutcomePillType.CollegeCredit
                  ? 'College Credit'
                  : 'no label';
        return (
            <GreyPill key={'outcome' + course.course_id}>{pillLabel}</GreyPill>
        );
    });
    const courseStartDt = course.start_dt ? new Date(course.start_dt) : course.start_dt;
    const courseEndDt = course.end_dt ? new Date(course.end_dt) : course.end_dt;
    const courseStartDtStr = courseStartDt ? courseStartDt.toLocaleDateString('en-US', 
        {
            year: 'numeric',
            month: '2-digit',
            day: 'numeric'
        })
     : ""
     const courseEndDtStr = courseEndDt ? courseEndDt.toLocaleDateString('en-US', 
        {
            year: 'numeric',
            month: '2-digit',
            day: 'numeric'
        })
     : "";
    const finalDateStr = " • " + courseStartDtStr + (courseStartDt || courseEndDt ? " - " : "") + courseEndDtStr
    if (view == ViewType.List) {
        return (
            <a
                className="card bg-base-teal body-small p-6 flex flex-row items-center"
                href={course.external_url}
                target="_blank"
            >
                <div className="flex flex-col justify-between gap-3">
                    <div className="flex flex-row gap-3 items-center">
                        <h2>{course.course_name}</h2>
                        <p className="body">|</p>
                        <p className="body">{course.provider_name}{finalDateStr}</p>
                        {coursePill}
                        {outcomePills}
                    </div>
                    <p className="body-small h-[1rem] line-clamp-2 overflow-hidden">
                        {course.description}
                    </p>
                </div>
            </a>
        );
    } else {
        return (
            <div className="card card-compact bg-base-teal overflow-hidden relative">
                <a
                    href={course.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <figure className="h-[124px]">
                        {coverImage !== '' ? (
                            <img
                                src={coverImage}
                                // TO DO: add in alt text here
                                alt=""
                                className="object-contain"
                            />
                        ) : (
                            <div className="bg-teal-1 h-full w-full"></div>
                        )}
                    </figure>
                    <div className="card-body gap-0.5">
                        {/* this should be the school or course that offers the course */}
                        <p className="text-xs">{course.provider_name}{finalDateStr}</p>
                        <h3 className="card-title text-sm">
                            {course.course_name}
                        </h3>
                        <p className="body-small line-clamp-2">
                            {course.description}
                        </p>
                        <div className="flex flex-col sm:flex-row flex-wrap py-1 mt-2 space-y-2 sm:space-y-0 sm:gap-2">
                            {coursePill} {outcomePills}
                        </div>
                    </div>
                </a>
            </div>
        );
    }
}
