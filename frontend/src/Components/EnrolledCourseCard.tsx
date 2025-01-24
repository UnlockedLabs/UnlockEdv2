import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import ProgressBar from './ProgressBar';
import { CourseStatus, RecentCourse, UserCourses, ViewType } from '@/common';
import ClampedText from './ClampedText';

// this might also want to live within courses, as the type of course it is (ie currently enrolled, completed, pending)
// recent would probably be a boolean, which would only need to be accessed on the homepage

export interface CourseCard {
    course: UserCourses | RecentCourse;
    recent?: boolean;
    view?: ViewType;
}

export default function EnrolledCourseCard({
    course,
    recent,
    view
}: CourseCard) {
    const coverImage = course.thumbnail_url;
    const url = course.external_url;
    let status: CourseStatus | null = null;
    if (course.course_progress == 100) status = CourseStatus.Completed;
    const courseStartDt = course.start_dt
        ? new Date(course.start_dt)
        : course.start_dt;
    const courseEndDt = course.end_dt ? new Date(course.end_dt) : course.end_dt;
    const courseStartDtStr = courseStartDt
        ? courseStartDt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
          })
        : '';
    const courseEndDtStr = courseEndDt
        ? courseEndDt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
          })
        : '';
    const finalDateStr =
        courseStartDt || courseEndDt
            ? ' • ' + courseStartDtStr + ' - ' + courseEndDtStr
            : '';
    const courseFullName = course.alt_name
        ? `${course.alt_name} - ${course.course_name}`
        : course.course_name;
    if (view == ViewType.List) {
        return (
            <a
                className="card bg-inner-background flex flex-row items-center justify-between body-small p-6"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
            >
                <div className="flex flex-row gap-3 items-center">
                    <h2>{course.course_name}</h2>
                    <p className="body">|</p>
                    <p className="body">
                        {course.provider_platform_name}
                        {finalDateStr}
                    </p>
                </div>
                {status === CourseStatus.Completed ? (
                    <div className="flex flex-row gap-2 body-small text-teal-3">
                        <CheckCircleIcon className="h-4" /> Course Completed
                    </div>
                ) : status === CourseStatus.Pending ? (
                    <div className="flex flex-row gap-2 body-small text-dark-yellow">
                        <ClockIcon className="h-4" /> Course Pending
                    </div>
                ) : (
                    <div className="w-1/3">
                        <ProgressBar
                            percent={Math.floor(course.course_progress)}
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
                    <div className="card-body gap-0.5 relative min-h-[150px] pb-10">
                        <ClampedText as="h3" className="card-title text-sm">
                            {courseFullName}
                        </ClampedText>
                        <p className="text-xs h-10 line-clamp-2">
                            {course.provider_platform_name}
                            {finalDateStr}
                        </p>
                        <div className="absolute bottom-2 left-4 right-4 z-10">
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
