import { BookmarkIcon } from "@heroicons/react/24/solid";
import { BookmarkIcon as BookmarkIconOutline } from "@heroicons/react/24/outline";
import { useState } from "react";
import { PillTagType } from "./CatalogCourseCard";
import OpenEnrollmentPill from "./pill-labels/OpenEnrollmentPill";
import PermissionOnlyPill from "./pill-labels/PermissionOnlyPill";
import SelfPacedPill from "./pill-labels/SelfPacedPill";

export default function CatalogCourseCardList({ course }: { course: any }) {
  const [savedCourse, setSavedCourse] = useState<boolean>(course.saved);

  const description =
    course.course_description +
    course.course_description +
    course.course_description +
    course.course_description +
    course.course_description;

  return (
    <div className="card bg-base-teal body-small p-6 flex flex-row items-center">
      <div className="flex flex-col justify-between gap-3">
        <div className="flex flex-row gap-3 items-center ">
          <div onClick={() => setSavedCourse(!savedCourse)}>
            {savedCourse ? (
              <BookmarkIcon className="h-5 text-primary-yellow" />
            ) : (
              <BookmarkIconOutline className="h-5 text-header-text" />
            )}
          </div>
          <h2>{course.program_name}</h2>
          <p className="body">|</p>
          <a href={course.provider_platform_url} className="body">
            {course.provider_platform_name}
          </a>
          {course.tags.map((tag) => {
            if (tag == PillTagType.Open) return <OpenEnrollmentPill />;
            if (tag == PillTagType.Permission) return <PermissionOnlyPill />;
            if (tag == PillTagType.SelfPaced) return <SelfPacedPill />;
          })}
        </div>
        <p className="body-small h-[2rem] line-clamp-2 overflow-hidden">
          {description}
        </p>
      </div>
    </div>
  );
}
