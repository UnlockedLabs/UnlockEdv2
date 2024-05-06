import { ArrowUpRightIcon } from "@heroicons/react/24/solid";

export default function CurrentlyEnrolledClass({ course }: { course: any }) {
    return (
        <div
            className={`card bg-inner-background flex flex-row justify-between body-small py-3 px-6`}
        >
            <div className="flex flex-row">
                <p className="font-bold w-[100px]">{course.course_code}</p>
                <p>{course.course_name}</p>
            </div>
            <a href={course.provider_platform_url} className="flex gap-2">
                <span>{course.provider_platform_name}</span>
                <ArrowUpRightIcon className="w-4" />
            </a>
        </div>
    );
}
