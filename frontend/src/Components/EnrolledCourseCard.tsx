import {
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import ProgressBar from "./ProgressBar";
import { CourseStatus } from "@/Pages/MyCourses";

// this might also want to live within courses, as the type of course it is (ie currently enrolled, completed, favorited, pending)
// recent would probably be a boolean, which would only need to be accessed on the homepage

export interface CourseCard {
  course: any; // TO DO: will change to be specific
  status: CourseStatus;
  favorited?: boolean;
}

export default function EnrolledCourseCard({
  course,
  status,
  favorited,
}: CourseCard) {
  const coverImage = course.thumbnail_url
  let url = course.external_url;
  // if (!url.startsWith("http://") && !url.startsWith("https://")) {
  //   url = "https://" + url;
  // }
  return (
    <div
      className={`card card-compact ${status == CourseStatus.Recent ? "bg-inner-background" : "bg-base-teal"} overflow-hidden relative min-w-[228px]`}
    >
      <div className="absolute top-2 right-2">
        {status !== CourseStatus.Recent &&
          (favorited ? (
            <StarIcon className="h-5 text-primary-yellow"></StarIcon>
          ) : (
            <StarIconOutline className="h-5 text-white"></StarIconOutline>
          ))}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <figure className="h-[124px]">
          {coverImage !== "" ?
            <img
              src={coverImage}
              // TO DO: add in alt text here
              alt=""
              className="object-contain"
            /> :
            <div className="bg-teal-1 h-full w-full"></div>
          }
        </figure>
        <div className="card-body gap-0.5">
          <p className="text-xs">{course.provider_platform_name}</p>
          <h3 className="card-title text-sm h-10">
            {course.alt_name && course.alt_name + " - "}{course.program_name}
          </h3>
          <div className="mt-3 justify-end">
            {status == CourseStatus.Completed ? (
              <div className="flex flex-row gap-2 body-small text-teal-3">
                <CheckCircleIcon className="h-4" /> Course Completed
              </div>
            ) : status == CourseStatus.Pending ? (
              <div className="flex flex-row gap-2 body-small text-dark-yellow">
                <ClockIcon className="h-4" /> Course Pending
              </div>
            ) : (
              <ProgressBar percent={Math.floor(course.course_progress)} />
            )}
          </div>
        </div>
      </a>
    </div>
  );
}
