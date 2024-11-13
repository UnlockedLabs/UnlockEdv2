import { StudentDashboardJoin } from '@/common';
import { AcademicCapIcon } from '@heroicons/react/24/outline';

export default function PopularCoursesCard({
    userData
}: {
    userData: StudentDashboardJoin;
}) {
    return (
        <div
            className={`card card-compact bg-inner-background overflow-hidden relative`}
        >
            <div className="card-body gap-0.5">
                <h3 className="card-title text-sm">
                    Popular Courses on UnlockEd
                </h3>
                <ul className="space-y-3 mt-3">
                    {userData.top_courses.map((name: string, idx: number) => {
                        return (
                            <li
                                className="body-small flex flex-row gap-2 content-center"
                                key={idx}
                            >
                                <AcademicCapIcon className="w-4" />
                                <p className="line-clamp-1">{name}</p>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
