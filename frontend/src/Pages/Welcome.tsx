import { useState, useEffect } from "react";
import Brand from "../Components/Brand";
import axios from "axios";

export default function Welcome() {
  const [imgSrc, setImgSrc] = useState("unlockedv1Sm.webp");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkLoggedIn = async () => {
    try {
      const response = await axios.get("/api/auth");
      if (response.data["data"] === null) {
        console.log(response.data["data"]);
        return
      }
      setIsLoggedIn(true);
      return
    } catch (error) {
      return;
    }
  }
  useEffect(() => {
    const img = new Image();
    img.src = "unlockedv1.png";
    img.onload = () => {
      setImgSrc("unlockedv1.png");
    };
    checkLoggedIn();
  }, []);

  return (
    <>
      <div className="min-h-screen font-lato">
        <div className="navbar bg-base-100">
          <div className="flex-1 pl-4 cursor-default select-none">
            <Brand />
          </div>
          <div className="flex-none">
            <ul className="menu menu-horizontal px-1 text-primary">
              {!isLoggedIn ? (
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
              <img
                src={imgSrc}
                className="mb-2 w-full h-auto"
                loading="lazy"
              />
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
                    1997
                  </time>
                  <div className="text-lg font-black text-neutral">
                    Young Beginnings
                  </div>
                  Co-Founders Jessica Hicklin and Chris
                  Santillan met at Potosi Correctional Center
                  before both of their 18th birthdays. They
                  were sentenced to life without parole and
                  told they would die behind bars.
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
                  Despite residing in a facility without
                  access to formal education for over a
                  quarter of a century, they were determined
                  to make a positive impact upon their own
                  lives and upon those with whom they lived
                  and worked with in their community. They
                  both maximized their circumstances, spending
                  years tutoring others to pass their
                  GED/Hi-Set exams and organizing victim
                  empathy and anger management courses for the
                  community.
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
                  With limited resources, Jessica and Chris
                  both taught themselves how to code without
                  the internet. They dreamed of a day when
                  they could create a solution for ways to
                  track rehabilitation and educational
                  programs on the inside.
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
                    Establishing Unlocked Labs
                  </div>
                  Their lives took a turn when a Supreme Court
                  declared life sentences for juveniles
                  unconstitutional. In 2017, Jessica and Chris
                  shared their aspirations of reimagining
                  education within the correctional system
                  with Haley Shoaf. Released in early 2022,
                  they teamed up with Haley, who helped them
                  expand upon their vision, to form Unlocked
                  Labs, a non-profit dedicated to consulting
                  and developing products addressing
                  challenges within the justice system.
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
                    UnlockED: A Vision Realized
                  </div>
                  Teaming up with external partners, they
                  developed UnlockEd, a non-profit, open
                  source education access and program
                  management system providing free education
                  to incarcerated individuals across the
                  country, fulfilling a long time dream, and
                  bringing the project full circle.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
