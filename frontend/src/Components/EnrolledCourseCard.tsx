import {
    CheckCircleIcon,
    ClockIcon,
    StarIcon
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import ProgressBar from './ProgressBar';
import React from 'react';
import API from '@/api/api';
import { CourseStatus, RecentCourse, UserCourses, ViewType } from '@/common';

// this might also want to live within courses, as the type of course it is (ie currently enrolled, completed, favorited, pending)
// recent would probably be a boolean, which would only need to be accessed on the homepage

export interface CourseCard {
    course: UserCourses | RecentCourse;
    recent?: boolean;
    view?: ViewType;
    callMutate?: () => void;
}

export default function EnrolledCourseCard({
    course,
    recent,
    view,
    callMutate
}: CourseCard) {
    const coverImage = course.thumbnail_url;
    const url = course.external_url;
    let status: CourseStatus;
    if (course.course_progress == 100) status = CourseStatus.Completed;

    function updateFavorite(e: React.MouseEvent) {
        e.preventDefault();
        API.put(`courses/${course.id}/save`, {})
            .then((response) => {
                callMutate();
                console.log(response);
            })
            .catch((error) => {
                console.log(error);
            });
    }
    if (view == ViewType.List) {
        return (
            <a
                className="card bg-inner-background flex flex-row items-center justify-between body-small p-6"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
            >
                <div className="flex flex-row gap-3 items-center">
                    <div onClick={(e) => updateFavorite(e)}>
                        {!recent &&
                            (course.is_favorited ? (
                                <StarIcon className="h-5 text-primary-yellow"></StarIcon>
                            ) : (
                                <StarIconOutline className="h-5 text-header-text"></StarIconOutline>
                            ))}
                    </div>
                    <h2>{course.course_name}</h2>
                    <p className="body">|</p>
                    <p className="body">{course.provider_platform_name}</p>
                </div>
                {status == CourseStatus.Completed ? (
                    <div className="flex flex-row gap-2 body-small text-teal-3">
                        <CheckCircleIcon className="h-4" /> Course Completed
                    </div>
                ) : status == CourseStatus.Pending ? (
                    <div className="flex flex-row gap-2 body-small text-dark-yellow">
                        <ClockIcon className="h-4" /> Course Pending
                    </div>
                ) : (
                    <div className="w-1/3">
                        <ProgressBar
                            percent={Math.floor(
                                course.course_progress as number
                            )}
                        />
                    </div>
                )}
            </a>
        );
    } else {
        return (
            <div
                className={`card card-compact ${recent ? 'bg-inner-background' : 'bg-base-teal'} overflow-hidden relative`}
            >
                <div
                    className="absolute top-2 right-2"
                    onClick={(e) => updateFavorite(e)}
                >
                    {!recent &&
                        (course.is_favorited ? (
                            <StarIcon className="h-5 text-primary-yellow"></StarIcon>
                        ) : (
                            <StarIconOutline className="h-5 text-white"></StarIconOutline>
                        ))}
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer">
                    <figure className="h-[124px]">
                        {coverImage !== '' ? (
                            <img
                                src={coverImage}
                                // TO DO: add in alt text here
                                alt=""
                                className="object-cover w-full h-full"
                            />
                        ) : (
                            <div className="bg-teal-1 h-full w-full"></div>
                        )}
                    </figure>
                    <div className="card-body gap-0.5">
                        <p className="text-xs line-clamp-1">
                            {course.provider_platform_name}
                        </p>
                        <h3 className="card-title text-sm h-10 line-clamp-2">
                            {course.alt_name && course.alt_name + ' - '}
                            {course.course_name}
                        </h3>
                        <div className="mt-3 justify-end">
                            {status == CourseStatus.Completed ? (
                                <div className="flex flex-row gap-2 body-small text-teal-3">
                                    <CheckCircleIcon className="h-4" /> Course
                                    Completed
                                </div>
                            ) : status == CourseStatus.Pending ? (
                                <div className="flex flex-row gap-2 body-small text-dark-yellow">
                                    <ClockIcon className="h-4" /> Course Pending
                                </div>
                            ) : (
                                <ProgressBar
                                    percent={Math.floor(course.course_progress)}
                                />
                            )}
                        </div>
                    </div>
                </a>
            </div>
        );
    }
}
