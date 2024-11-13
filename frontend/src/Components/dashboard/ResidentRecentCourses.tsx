import { RecentCourse, StudentDashboardJoin } from '@/common';
import ExploreCourseCatalogCard from './ExploreCourseCatalogCard';
import CourseCard from '../EnrolledCourseCard';
import PopularCoursesCard from './PopularCoursesCard';

export default function ResidentRecentCourses({
    userData
}: {
    userData: StudentDashboardJoin;
}) {
    return (
        <div
            className={`gap-5 grid grid-cols-3 ${userData.recent_courses.length < 2 ? '!grid-cols-2' : ''}`}
        >
            {userData?.recent_courses.map(
                (course: RecentCourse, index: number) => {
                    return <CourseCard course={course} recent key={index} />;
                }
            )}
            {userData.recent_courses.length < 3 && <ExploreCourseCatalogCard />}
            {userData.recent_courses.length < 2 && (
                <PopularCoursesCard userData={userData} />
            )}
        </div>
    );
}
