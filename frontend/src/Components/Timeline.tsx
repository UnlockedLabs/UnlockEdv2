interface TimelineEvent {
    year: string;
    title: string;
    description: string;
}

const timelineEvents: TimelineEvent[] = [
    {
        year: '1997',
        title: 'Young Beginnings',
        description:
            'Co-Founders Jessica Hicklin and Chris Santillan meet at Potosi Correctional Center before age 18. Both were sentenced to life without parole and began dreaming of a better future from inside.'
    },
    {
        year: '1998 - 2017',
        title: 'Education Against the Odds',
        description:
            'While incarcerated, Jessica and Chris created education spaces for others—tutoring peers, organizing courses, and building a culture of learning in a system with no formal access.'
    },
    {
        year: '2012 - 2017',
        title: 'Coding for Change',
        description:
            'With no internet and limited resources, Jessica and Chris taught themselves to code from inside prison. They dreamed of a day when they could build a tool to track rehabilitation and education for others like them—something that could support transformation from the inside out. That dream became the foundation for what would later become UnlockEd.'
    },
    {
        year: '2022',
        title: 'Unlocked Labs Is Born',
        description:
            'After a Supreme Court ruling led to their release, Jessica and Chris teamed up with Haley Shoaf to found Unlocked Labs, a nonprofit, building tech tools to improve outcomes in the justice system.'
    },
    {
        year: '2022 - present',
        title: 'UnlockEd: A Vision Realized',
        description:
            'With support from partners and community, the team created UnlockEd, a free, open-source education platform for incarcerated learners. This project fulfilled Jessica and Chris’s long-held dream: to build a system that makes education and rehabilitation more accessible from the inside out.'
    },
    {
        year: 'February 2025',
        title: 'First Facility Launch: Maine',
        description:
            'UnlockEd v2 officially launches at Mountain View Correctional Facility—its first in-facility deployment. This release features the Knowledge Center, enabling residents to access curated, self-guided educational content.'
    }
];

export default function Timeline() {
    return (
        <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
            {timelineEvents.map((event, index) => (
                <li key={index}>
                    <hr />
                    <div className="timeline-middle">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-5 w-5"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div
                        className={`timeline-${index % 2 === 0 ? 'start md:text-end' : 'end'} mb-10`}
                    >
                        <time className="font-mono italic text-secondary">
                            {event.year}
                        </time>
                        <div className="text-lg font-black text-neutral">
                            {event.title}
                        </div>
                        <p
                            className={`${index % 2 === 0 ? 'text-right' : 'text-left'}`}
                        >
                            {event.description}
                        </p>
                    </div>
                    {index < timelineEvents.length - 1 && <hr />}
                </li>
            ))}
        </ul>
    );
}
