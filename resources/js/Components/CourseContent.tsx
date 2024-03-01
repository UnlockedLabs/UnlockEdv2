import { User } from "@/common";
import useSWR from "swr";

export default function CourseContent({ user }: { user: User }) {
    const {
        data: enrollments,
        error,
        isLoading,
    } = useSWR(`/api/v1/enrollments`);

    function CourseCard({ course }: { course: any }) {
        const {
            data: courseInfo,
            error: courseInfoError,
            isLoading: courseInfoLoading,
        } = useSWR(`/api/v1/courses/${course.course_id}`);
        const {
            data: providerInfo,
            error: providerInfoError,
            isLoading: providerInfoLoading,
        } = useSWR(`/api/v1/provider-platforms/${course.provider_platform_id}`);

        // Function to truncate the description to the first 100 characters
        const truncateDescription = (description: string) => {
            if (description.length > 100) {
                return description.slice(0, 100) + "...";
            } else {
                return description;
            }
        };
        return (
            // temp solution for height, make sure they are all the same height without fixing it
            <div className="h-[400px]">
                {!courseInfoError &&
                !courseInfoLoading &&
                !providerInfoLoading &&
                !providerInfoError ? (
                    <div className="card card-compact bg-base-100 shadow-xl h-full">
                        <figure>
                            <img src={providerInfo.data.icon_url} alt="" />
                        </figure>
                        <div className="card-body">
                            <h2 className="card-title">
                                {courseInfo.data.provider_course_name}
                            </h2>
                            <p>
                                {truncateDescription(
                                    courseInfo.data.description,
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 grid grid-cols-3 gap-5 w-[85%]">
            {!isLoading && !error ? (
                enrollments.data.map((course: any) => (
                    <CourseCard
                        course={course}
                        key={course.provider_course_id}
                    />
                ))
            ) : (
                <div></div>
            )}
        </div>
    );
}
