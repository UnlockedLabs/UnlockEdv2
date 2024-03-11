import { Head, Link } from "@inertiajs/react";
import { PageProps } from "@/types";
import Brand from "@/Components/Brand";

export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="Welcome" />
            <div className="min-h-screen font-lato">
                <div className="navbar bg-base-100">
                    <div className="flex-1 pl-4">
                        <Brand />
                    </div>
                    <div className="flex-none">
                        <ul className="menu menu-horizontal px-1 text-teal-500">
                            {!auth.user ? (
                                <>
                                    <li>
                                        <a href="login">Log in</a>
                                    </li>
                                </>
                            ) : (
                                <li>
                                    <a href="/dashboard">Dashboard</a>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="flex justify-center p-10 bg-base-100">
                    <div className="prose prose-lg prose-gray text-justify">
                        <h1>Built from the inside out...</h1>

                        <p>
                            Our mission is to make education accessible to all
                            justice-impacted people, and to ensure that their
                            educational progress is recorded and recognized by
                            institutions allowing for a faster and more
                            equitable re-entry process.
                        </p>

                        <div className="flex flex-col">
                            <img src="unlockedv1.png" className="mb-2" />
                            <span className="italic text-sm">
                                Version 1 of UnlockEd was built inside without
                                the help of the internet.
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
                                        1984
                                    </time>
                                    <div className="text-lg font-black text-white">
                                        First Macintosh computer
                                    </div>
                                    The Apple Macintosh—later rebranded as the
                                    Macintosh 128K—is the original Apple
                                    Macintosh personal computer. It played a
                                    pivotal role in establishing desktop
                                    publishing as a general office function. The
                                    motherboard, a 9 in (23 cm) CRT monitor, and
                                    a floppy drive were housed in a beige case
                                    with integrated carrying handle; it came
                                    with a keyboard and single-button mouse.
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
                                        1998
                                    </time>
                                    <div className="text-lg font-black text-white">
                                        iMac
                                    </div>
                                    iMac is a family of all-in-one Mac desktop
                                    computers designed and built by Apple Inc.
                                    It has been the primary part of Apple's
                                    consumer desktop offerings since its debut
                                    in August 1998, and has evolved through
                                    seven distinct forms
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
                                        2001
                                    </time>
                                    <div className="text-lg font-black text-white">
                                        iPod
                                    </div>
                                    The iPod is a discontinued series of
                                    portable media players and multi-purpose
                                    mobile devices designed and marketed by
                                    Apple Inc. The first version was released on
                                    October 23, 2001, about 8+1⁄2 months after
                                    the Macintosh version of iTunes was
                                    released. Apple sold an estimated 450
                                    million iPod products as of 2022. Apple
                                    discontinued the iPod product line on May
                                    10, 2022. At over 20 years, the iPod brand
                                    is the oldest to be discontinued by Apple
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
                                        2007
                                    </time>
                                    <div className="text-lg font-black text-white">
                                        iPhone
                                    </div>
                                    iPhone is a line of smartphones produced by
                                    Apple Inc. that use Apple's own iOS mobile
                                    operating system. The first-generation
                                    iPhone was announced by then-Apple CEO Steve
                                    Jobs on January 9, 2007. Since then, Apple
                                    has annually released new iPhone models and
                                    iOS updates. As of November 1, 2018, more
                                    than 2.2 billion iPhones had been sold. As
                                    of 2022, the iPhone accounts for 15.6% of
                                    global smartphone market share
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
                                        2015
                                    </time>
                                    <div className="text-lg font-black text-white">
                                        Apple Watch
                                    </div>
                                    The Apple Watch is a line of smartwatches
                                    produced by Apple Inc. It incorporates
                                    fitness tracking, health-oriented
                                    capabilities, and wireless
                                    telecommunication, and integrates with iOS
                                    and other Apple products and services
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
