import { BookmarkIcon } from "@heroicons/react/24/solid";
import { BookmarkIcon as BookmarkIconOutline } from "@heroicons/react/24/outline";
import { useState } from "react";
import OpenEnrollmentPill from "./pill-labels/OpenEnrollmentPill";
import PermissionOnlyPill from "./pill-labels/PermissionOnlyPill";
import SelfPacedPill from "./pill-labels/SelfPacedPill";

export interface CatalogCourseCard {
    name: string,
    img_url: string,
    url: string,
    provider_platform_name: string,
    tags: Array<PillTagType>,
    saved: boolean
}

export enum PillTagType {
    Open = "Open",
    Permission = "Permission",
    SelfPaced = "SelfPaced"
}

export default function CatalogCourseCard({course}:{course:any}){
    const [savedCourse, setSavedCourse] = useState<boolean>(course.saved);

    return(
        <div className="card card-compact bg-base-teal overflow-hidden relative">
            <div className="absolute top-2 right-2" onClick={() => setSavedCourse(!savedCourse)}>
                { savedCourse ? <BookmarkIcon className="h-5 text-primary-yellow"/> : <BookmarkIconOutline className="h-5 text-white"/>}
            </div>
            <a href={course.url} target="_blank" rel="noopener noreferrer">
                <figure className="h-[124px]">
                <img
                    src={course.img_url}
                    // TO DO: add in alt text here
                    alt=""
                    className="object-contain"
                />
                </figure>
                <div className="card-body gap-0.5">
                {/* this should be the school or program that offers the course */}
                <p className="text-xs">{course.provider_platform_name}</p>
                <h3 className="card-title text-sm">{course.course_name}</h3>
                <p className="body-small line-clamp-2">{course.course_description}</p>
                <div className="flex flex-row py-1 gap-2 mt-2">
                    {course.tags.map((tag) => {
                        if (tag == PillTagType.Open) return <OpenEnrollmentPill />
                        if (tag == PillTagType.Permission) return <PermissionOnlyPill />
                        if (tag == PillTagType.SelfPaced) return <SelfPacedPill />
                    })}
                </div>
                </div>
            </a>
        </div>
    )
}