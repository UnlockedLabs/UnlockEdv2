import { CurrentEnrollment, StudentDashboardJoin } from '@/common';
import CurrentlyEnrolledClass from '../CurrentlyEnrolledClass';

export default function CurrentlyEnrolledCourses({
    userData
}: {
    userData: StudentDashboardJoin;
}) {
    return (
        <div className="mt-3 bg-base-teal p-6 card">
            <div className="flex flex-col gap-3">
                {userData.enrollments ? (
                    userData?.enrollments?.map(
                        (course: CurrentEnrollment, index: number) => (
                            <CurrentlyEnrolledClass
                                course={course}
                                key={index}
                            />
                        )
                    )
                ) : (
                    <p className="body-small">
                        You are currently not enrolled in any courses.
                    </p>
                )}
            </div>
        </div>
    );
}
