import NotificationCard from './NotificationCard';
import { Announcement, NotificationType } from '@/common.ts';

const date = new Date();

const announcements: Announcement[] = [
    {
        course_name: 'Data and Algorithms',
        title: 'Enrollment Approved',
        message:
            'You are now enrolled in Data and Algorithms from Harvard University.',
        url: '',
        provider_platform: 'Canvas',
        due: date
    },
    {
        course_name: 'Advanced English Composition',
        title: 'Schedule Change',
        message: 'Advanced English Composition is now M/W 10:30am-12pm.',
        url: '',
        provider_platform: 'Canvas',
        due: date
    },
    {
        course_name: 'Linear Algebra',
        title: 'Midterm Grades Out',
        message:
            'Hi everyone, midterm grades have been posted. Please reach out if you have any questions.',
        url: '',
        provider_platform: 'Canvas',
        due: date
    }
];

const toDo: Announcement[] = [
    {
        title: 'Assignment 4',
        course_name: 'Introduction to Computer Science',
        provider_platform: 'Kolibri',
        message: 'Please submit your assignment 4 by the end of the day.',
        url: '',
        due: date
    },
    {
        title: 'Homework 6',
        course_name: 'Linear Algebra',
        provider_platform: 'WashU Canvas',
        message: 'Please submit your homework 6 by the end of the day.',
        url: '',
        due: date
    }
];

export default function NotificationsSideBar() {
    // call the data here in the future

    return (
        <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background">
            <div className="mt-4 mx-9 p-4">
                <h2 className="mb-4">Announcements</h2>
                <div className="flex flex-col gap-4">
                    {announcements.map((cardInfo: Announcement) => {
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
                    {toDo.map((cardInfo: Announcement) => {
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
