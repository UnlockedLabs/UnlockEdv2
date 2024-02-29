const data = [
    {
        title: "Introduction to Cyber Security",
        description:
            "Master the art of protecting systems and data against complex cyber threat and vulnerability.",
        logo: "https://www.instructure.com/sites/default/files/image/2021-12/Canvas_Horizontal_ByInstructure_Color_RGB.png",
        providerCourseId: 11111,
    },
    {
        title: "Business Analytics",
        description:
            "Drive strategic decisions by mastering analytical tools that transform data into business insights.",
        logo: "https://grow.google/root/static/images/logo_GwG.svg",
        providerCourseId: 22222,
    },
    {
        title: "Entrepreneuership",
        description:
            "Learn to launch and grow innovative business with essential entrepreneurial skills and strategies.",
        logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/EdX_Logo.PNG",
        providerCourseId: 33333,
    },
    {
        title: "Anger Management",
        description:
            "Develop skills to effectively manage anger, fostering personal growth and stronger relationships.",
        logo: "https://grow.google/root/static/images/logo_GwG.svg",
        providerCourseId: 44444,
    },
];

export default function CourseContent(course: any) {
    function CourseCard({ course }: { course: any }) {
        return (
            <div className="card card-compact bg-base-100 shadow-xl">
                <figure>
                    <img
                        src="https://endoftheroll.com/wp-content/uploads/2022/12/dt_X714RCT28MT.jpg"
                        alt=""
                    />
                </figure>
                <div className="card-body">
                    <h2 className="card-title">{course.title}</h2>
                    <p>{course.description}</p>
                    <div className="card-actions grid grid-cols-2 gap-32 justify-between">
                        <img
                            src={course.logo}
                            className="object-contain h-10 my-auto"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 grid grid-cols-3 gap-5">
            {data.map((course: any) => (
                <CourseCard course={course} key={course.providerCourseId} />
            ))}
        </div>
    );
}
