import { useEffect, useState } from 'react';
import Brand from '../Components/Brand';
import { INIT_KRATOS_LOGIN_FLOW, ServerResponse, User } from '@/common';
import API from '@/api/api';
import { Link } from 'react-router-dom';
import { AUTHCALLBACK } from '@/useAuth';

export default function Welcome() {
    const [imgSrc, setImgSrc] = useState('unlockedv2Sm.webp');
    const [authUser, setAuthUser] = useState<User | undefined>();

    useEffect(() => {
        const img = new Image();
        img.src = 'unlockedv2.png';
        img.onload = () => {
            setImgSrc('unlockedv2.png');
        };
        API.get<User>(`auth`)
            .then((user: ServerResponse<User>) => {
                if (user.success) {
                    setAuthUser(user.data as User);
                }
            })
            .catch(() => {
                return;
            });
    }, []);

    return (
        <div className="min-h-screen font-lato">
            <div className="navbar bg-background">
                <div className="flex-1 pl-4 cursor-default select-none">
                    <Brand />
                </div>
                <div className="flex-none">
                    <ul className="menu menu-horizontal px-1 text-primary">
                        {!authUser ? (
                            <li>
                                <a href={INIT_KRATOS_LOGIN_FLOW}>Log in</a>
                            </li>
                        ) : (
                            <li>
                                <Link to={AUTHCALLBACK}>Dashboard</Link>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            <div className="flex justify-center p-10 bg-background">
                <div className="prose prose-lg prose-gray text-justify">
                    <h1>Built from the inside out...</h1>

                    <p>
                        Our mission is to make education accessible to all
                        justice-impacted people, and to ensure that their
                        educational progress is recorded and recognized by
                        institutions allowing for a faster and more equitable
                        re-entry process.
                    </p>
                    <div className="flex items-center h-8 border rounded-[15px] text-lg justify-center text-black bg-emerald-200 overflow-hidden">
                        <img
                            src="/emoji_image_new.png"
                            className="w-8 h-8 object-contain"
                            loading="lazy"
                            alt="Emoji"
                        />
                        Now live in correctional facilities!
                    </div>

                    <div className="flex flex-col">
                        <img
                            src={imgSrc}
                            className="mb-2 w-full h-auto"
                            loading="lazy"
                        />
                        <span className="italic text-sm">
                            Version 2 of UnlockEd is now in use at Mountain View
                            Correctional Facility, featuring an updated design
                            and a new self-guided learning experience.
                        </span>
                    </div>

                    <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
                        <li>
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
                            <div className="timeline-start md:text-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    1997
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    Young Beginnings
                                </div>
                                Co-Founders Jessica Hicklin and Chris Santillan
                                meet at Potosi Correctional Center before age
                                18. Both were sentenced to life without parole
                                and began dreaming of a better future from
                                inside.
                            </div>
                            <hr />
                        </li>
                        <li>
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
                            <div className="timeline-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    1998 - 2017
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    Education Against the Odds
                                </div>
                                While incarcerated, Jessica and Chris created
                                education spaces for others—tutoring peers,
                                organizing courses, and building a culture of
                                learning in a system with no formal access.
                            </div>
                            <hr />
                        </li>
                        <li>
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
                            <div className="timeline-start md:text-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    2012 - 2017
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    Coding for Change
                                </div>
                                With no internet and limited resources, Jessica
                                and Chris taught themselves to code from inside
                                prison. They dreamed of a day when they could
                                build a tool to track rehabilitation and
                                education for others like them—something that
                                could support transformation from the inside
                                out. That dream became the foundation for what
                                would later become UnlockEd.
                            </div>
                            <hr />
                        </li>
                        <li>
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
                            <div className="timeline-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    2022
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    Unlocked Labs Is Born
                                </div>
                                After a Supreme Court ruling led to their
                                release, Jessica and Chris teamed up with Haley
                                Shoaf to found Unlocked Labs, a nonprofit
                                building tech tools to improve outcomes in the
                                justice system.
                            </div>
                            <hr />
                        </li>
                        <li>
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
                            <div className="timeline-start md:text-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    2022 - present
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    UnlockEd: A Vision Realized
                                </div>
                                With support from partners and community, the
                                team created UnlockEd, a free, open-source
                                education platform for incarcerated learners.
                                This project fulfilled Jessica and Chris&#8217;s
                                long-held dream: to build a system that makes
                                education and rehabilitation more accessible
                                from the inside out.
                            </div>
                        </li>
                        <li>
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
                            <div className="timeline-end mb-10">
                                <time className="font-mono italic text-secondary">
                                    February 2025
                                </time>
                                <div className="text-lg font-black text-neutral">
                                    First Facility Launch: Maine
                                </div>
                                UnlockEd v2 officially launches at Mountain View
                                Correctional Facility—its first in-facility
                                deployment. This release features the Knowledge
                                Center, enabling residents to access curated,
                                self-guided educational content.
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
