import {
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import { CourseCard } from "./EnrolledCourseCard";
import ProgressBar from "./ProgressBar";
import { CourseStatus } from "@/Pages/MyCourses";

export default function EnrolledCourseCardList({
  course,
  status,
  recent,
  favorited,
}: CourseCard) {
  return (
    <div className="card bg-inner-background flex flex-row items-center justify-between body-small p-6">
      <div className="flex flex-row gap-3 items-center">
        {!recent &&
          (favorited ? (
            <StarIcon className="h-5 text-primary-yellow"></StarIcon>
          ) : (
            <StarIconOutline className="h-5 text-header-text"></StarIconOutline>
          ))}
        <h2>{course.course_name}</h2>
        <p className="body">|</p>
        <a href={course.provider_platform_url} className="body">
          {course.provider_platform_name}
        </a>
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
          <ProgressBar percent={course.percent_completed} />
        </div>
      )}
    </div>
  );
}
