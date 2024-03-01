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
        if (!courseInfoError && !courseInfoLoading) console.log(courseInfo);
        const {
            data: providerInfo,
            error: providerInfoError,
            isLoading: providerInfoLoading,
        } = useSWR(`/api/v1/provider-platforms/${course.provider_platform_id}`);
        if (!providerInfoError && !providerInfoLoading)
            console.log(providerInfo);
        return (
            <div>
                {!courseInfoError &&
                !courseInfoLoading &&
                !providerInfoLoading &&
                !providerInfoError ? (
                    <div className="card card-compact bg-base-100 shadow-xl">
                        <figure>
                            <img src={providerInfo.data.icon_url} alt="" />
                        </figure>
                        <div className="card-body">
                            <h2 className="card-title">
                                {courseInfo.data.provider_course_name}
                            </h2>
                            <p>{courseInfo.data.description}</p>
                        </div>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 grid grid-cols-4 gap-5">
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
