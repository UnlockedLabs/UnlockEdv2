import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';
import LightGreenPill from './pill-labels/LightGreenPill';
import RedPill from './pill-labels/RedPill';
import YellowPill from './pill-labels/YellowPill';
import GreyPill from './pill-labels/GreyPill';
import { MouseEvent } from 'react';
import {
    CourseCatalogue,
    OutcomePillType,
    PillTagType,
    ViewType
} from '@/common';
import API from '@/api/api';

export default function CatalogCourseCard({
    course,
    callMutate,
    view
}: {
    course: CourseCatalogue;
    callMutate: () => void;
    view?: ViewType;
}) {
    const coverImage = course.thumbnail_url;
    const course_type: PillTagType = course.course_type as PillTagType;

    function updateFavorite(e: MouseEvent) {
        e.preventDefault();
        API.put(`courses/${course.course_id}/save`, {})
            .then(() => {
                callMutate();
            })
            .catch((error) => {
                console.log(error);
            });
    }

    let coursePill: JSX.Element;
    if (course_type == PillTagType.Open)
        coursePill = <LightGreenPill>Open Enrollment</LightGreenPill>;
    if (course_type == PillTagType.Permission)
        coursePill = <RedPill>Permission Only</RedPill>;
    if (course_type == PillTagType.SelfPaced)
        coursePill = <YellowPill>Self-Paced</YellowPill>;

    let bookmark: JSX.Element;
    if (course.is_favorited)
        bookmark = <BookmarkIcon className="h-5 text-primary-yellow" />;
    else
        bookmark = (
            <BookmarkIconOutline
                className={`h-5 ${view == ViewType.List ? 'text-header-text' : 'text-white'}`}
            />
        );

    const outcomeTypes: OutcomePillType[] = course.outcome_types
        .split(',')
        .map((outcome) => outcome as OutcomePillType)
        .filter((type) =>
            Object.values(OutcomePillType).includes(type as OutcomePillType)
        );
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
    if (view == ViewType.List) {
        return (
            <a
                className="card bg-base-teal body-small p-6 flex flex-row items-center"
                href={course.external_url}
                target="_blank"
            >
                <div className="flex flex-col justify-between gap-3">
                    <div className="flex flex-row gap-3 items-center">
                        <div onClick={(e) => updateFavorite(e)}>{bookmark}</div>
                        <h2>{course.course_name}</h2>
                        <p className="body">|</p>
                        <p className="body">{course.provider_name}</p>
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
                <div
                    className="absolute top-2 right-2"
                    onClick={(e) => updateFavorite(e)}
                >
                    {bookmark}
                </div>
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
                        <p className="text-xs">{course.provider_name}</p>
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
