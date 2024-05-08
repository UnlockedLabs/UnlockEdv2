export default function CourseCard({ course }: { course: any }) {
  const coverImage = course.img_url;
  let url = course.external_link_url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return (
    <div
      className={`h-[200px] w-1/3 card card-compact bg-inner-background overflow-hidden`}
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <figure className="h-24">
          <img
            src={coverImage}
            // TO DO: add in alt text here
            alt=""
            className="object-contain"
          />
        </figure>
        <div className="card-body gap-0.5">
          <p className="text-xs">{course.provider_platform_name}</p>
          <h3 className="card-title text-sm">
            {course.course_code} - {course.course_name}
          </h3>
          {/* here will go the bar of progress, pending the backend on that. */}
        </div>
      </a>
    </div>
  );
}
