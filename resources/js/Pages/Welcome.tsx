import { Head, Link } from "@inertiajs/react";
import { PageProps } from "@/types";
import Brand from "@/Components/Brand";

export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="Welcome" />
            <div className="min-h-screen">
                <div className="navbar bg-base-100">
                    <div className="flex-1 pl-4">
                        <Brand />
                    </div>
                    <div className="flex-none">
                        <ul className="menu menu-horizontal px-1 text-white">
                            {!auth.user ? (
                                <>
                                    <li>
                                        <a href="login">Log in</a>
                                    </li>
                                    <li>
                                        <a href="register">Register</a>
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
                        <h1>Our Story</h1>
                        <p>
                            Catalyzing justice reform at a human level... We run
                            programs to train justice-impacted people in tech
                            skills We run a development shop employing returning
                            citizens. We build products to solve challenges
                            within the justice system helps catalyze reform at a
                            system level. We are building Open Source tools to
                            disrupt the cycle of limited access and data in
                            correctional programing
                        </p>
                        <img src="/unlockedv1.png" />
                        <p>
                            Our mission is to make education accessible to all
                            justice-impacted people, and to ensure that their
                            educational progress is recorded and recognized by
                            institutions allowing for a faster and more
                            equitable re-entry process.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
