import NotificationCard, { NotificationType } from "./NotificationCard";

const date = new Date();

const announcements = [
  {
    title: "Enrollment Approved",
    message:
      "You are now enrolled in Data and Algorithms from Harvard University.",
    url: "",
  },
  {
    course_name: "Advanced English Composition",
    title: "Schedule Change",
    message: "Advanced English Composition is now M/W 10:30am-12pm.",
    url: "",
  },
  {
    course_name: "Linear Algebra",
    title: "Midterm Grades Out",
    message:
      "Hi everyone, midterm grades have been posted. Please reach out if you have any questions.",
    url: "",
  },
];

const toDo = [
  {
    title: "Assignment 4",
    course_name: "Introduction to Computer Science",
    provider_platform: "Kolibri",
    url: "",
    due: date,
  },
  {
    title: "Homework 6",
    course_name: "Linear Algebra",
    provider_platform: "WashU Canvas",
    url: "",
    due: date,
  },
];

export default function NotificationsSideBar() {
  // call the data here in the future

  return (
    <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background">
      <div className="mt-4 mx-9 p-4">
        <h2 className="mb-4">Announcements</h2>
        <div className="flex flex-col gap-4">
          {announcements.map((cardInfo: any) => {
            return (
              <NotificationCard
                cardInfo={cardInfo}
                type={NotificationType.Announcement}
                key={cardInfo.title}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-4 mx-9 p-4">
        <h2 className="mb-4">To Do</h2>
        <div className="flex flex-col gap-4">
          {toDo.map((cardInfo: any) => {
            return (
              <NotificationCard
                cardInfo={cardInfo}
                type={NotificationType.ToDo}
                key={cardInfo.title}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
