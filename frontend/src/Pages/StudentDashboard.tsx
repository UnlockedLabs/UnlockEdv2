import CourseCard from '@/Components/EnrolledCourseCard';
import CurrentlyEnrolledClass from '@/Components/CurrentlyEnrolledClass';
import { useAuth } from '@/AuthContext';
import useSWR from 'swr';
import convertSeconds from '@/Components/ConvertSeconds';
import ResourcesSideBar from '@/Components/ResourcesSideBar';
import WeekActivityChart from '@/Components/WeeklyActivity';
import Error from './Error';
import { useNavigate } from 'react-router-dom';
import {
    AcademicCapIcon,
    ArrowRightIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/outline';
import {
    CurrentEnrollment,
    RecentCourse,
    ServerResponse,
    StudentDashboardJoin
} from '@/common';
import CalendarComponent from '@/Components/Calendar';

export default function StudentDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data, error, isLoading } = useSWR<
        ServerResponse<StudentDashboardJoin>
    >(`/api/users/${user.id}/student-dashboard`);
    const userData = data?.data as StudentDashboardJoin;

    if (isLoading) return <div>Loading...</div>;
    if (error) return <Error />;

    const ExploreCourseCatalogCard = () => {
        return (
            <div className="card card-compact bg-inner-background relative">
                <figure className="h-[124px] bg-teal-3">
                    <BuildingStorefrontIcon className="h-20 text-background" />
                </figure>
                <div className="card-body gap-0.5">
                    <h3 className="card-title text-sm">
                        Explore Course Catalog
                    </h3>
                    <p className="body-small line-clamp-4">
                        Looking for more content to engage with? Browse courses
                        offered at your facility.
                    </p>
                    <a
                        className="flex flex-row gap-1 body-small text-teal-3 mt-2"
                        onClick={() => navigate(`/course-catalog`)}
                    >
                        Explore courses
                        <ArrowRightIcon className="w-4" />
                    </a>
                </div>
            </div>
        );
    };

    const PopularCoursesCard = () => {
        return (
            <div
                className={`card card-compact bg-inner-background overflow-hidden relative`}
            >
                <div className="card-body gap-0.5">
                    <h3 className="card-title text-sm">
                        Popular Courses on UnlockEd
                    </h3>
                    <ul className="space-y-3 mt-3">
                        {userData.top_courses.map(
                            (name: string, idx: number) => {
                                return (
                                    <li
                                        className="body-small flex flex-row gap-2 content-center"
                                        key={idx}
                                    >
                                        <AcademicCapIcon className="w-4" />
                                        <p className="line-clamp-1">{name}</p>
                                    </li>
                                );
                            }
                        )}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <div className="flex w-full">
            <div className="px-8 py-4">
                <h1 className="text-5xl">Hi, {user.name_first}!</h1>
                <h2 className="mt-7"> Pick Up Where You Left Off</h2>
                <div className="mt-3 bg-base-teal p-6 card">
                    <div
                        className={`gap-5 grid grid-cols-3 ${userData.recent_courses.length < 2 ? '!grid-cols-2' : ''}`}
                    >
                        {userData?.recent_courses.map(
                            (course: RecentCourse, index: number) => {
                                return (
                                    <CourseCard
                                        course={course}
                                        recent={true}
                                        key={index}
                                    />
                                );
                            }
                        )}
                        {userData.recent_courses.length < 3 && (
                            <ExploreCourseCatalogCard />
                        )}
                        {userData.recent_courses.length < 2 && (
                            <PopularCoursesCard />
                        )}
                    </div>
                </div>
                <div className="flex flex-row gap-12 mt-12">
                    <div className="w-1/2 h-[254px] bg-base-teal card">
                        <h2 className="mt-4 ml-4">My Activity</h2>
                        <WeekActivityChart data={userData?.week_activity} />
                    </div>
                    <div className="w-1/2 h-[254px] bg-base-teal card">
                        <h2 className="mt-4 ml-4">Learning Time</h2>
                        <div className="px-4">
                            <table className="w-full">
                                <thead>
                                    <tr className="flex flex-row justify-between border border-x-0 border-t-0 mt-2">
                                        <th className="body text-grey-4">
                                            Course Name
                                        </th>
                                        <th className="body text-grey-4">
                                            Hours Spent
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-4 mt-4 overflow-auto h-36 scrollbar">
                                    {!error &&
                                    !isLoading &&
                                    userData.enrollments !== null ? (
                                        userData?.enrollments?.map(
                                            (
                                                course: CurrentEnrollment,
                                                index: number
                                            ) => {
                                                const totalTime =
                                                    convertSeconds(
                                                        course.total_activity_time
                                                    );
                                                return (
                                                    <tr
                                                        className="flex flex-row justify-between mr-3"
                                                        key={index}
                                                    >
                                                        <td className="body-small">
                                                            {course.name}
                                                        </td>
                                                        <td className="body-small">
                                                            {totalTime.number +
                                                                ' ' +
                                                                totalTime.label}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )
                                    ) : (
                                        <p className="body-small">
                                            No activity to show.
                                        </p>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <h2 className="mt-12">Currently Enrolled Classes</h2>
                <div className="mt-3 bg-base-teal p-6 card">
                    {!error && !isLoading && (
                        <div className="flex flex-col gap-3">
                            {userData.enrollments ? (
                                userData?.enrollments?.map(
                                    (course: CurrentEnrollment, index) => (
                                        <CurrentlyEnrolledClass
                                            course={course}
                                            key={index}
                                        />
                                    )
                                )
                            ) : (
                                <p className="body-small">
                                    You are currently not enrolled in any
                                    courses.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="min-w-px bg-grey-1"></div>
            <ResourcesSideBar />
        </div>
    );
}
