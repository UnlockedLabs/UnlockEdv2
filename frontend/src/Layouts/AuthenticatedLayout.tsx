import { useState } from 'react';
import Navbar from '@/Components/Navbar';
import { useMatches, UIMatch, Outlet } from 'react-router-dom';
import PageNav from '@/Components/PageNav';
import { RouteLabel } from '@/common';

// Extend RouteMatch with custom RouteMeta
interface CustomRouteMatch extends UIMatch {
    handle: RouteLabel;
}

export default function AuthenticatedLayout() {
    const matches = useMatches() as CustomRouteMatch[];
    const currentMatch = matches.find((match) => match?.handle?.title);
    const title = currentMatch?.handle?.title ?? 'UnlockEd';
    // We have three states we need to factor for.
    // 1. If the nav is open & pinned (Large screens only & uses lg:drawer-open)
    // 2. If the nav is open & not pinned (Large screens only)
    // 3. If the nav is not open. (Small screens only)

    const getInitialPinnedState = () => {
        const storedNavPinned = localStorage.getItem('navPinned') ?? 'true';
        return JSON.parse(storedNavPinned) as boolean;
    };

    const [isNavOpen, setIsNavOpen] = useState(false);
    const [isNavPinned, setIsNavPinned] = useState(getInitialPinnedState);

    const showNav = () => {
        setIsNavPinned(false);
        setIsNavOpen(true);
    };

    const togglePin = () => {
        const newPinnedState = !isNavPinned;
        setIsNavPinned(newPinnedState);
        setIsNavOpen(newPinnedState);
        localStorage.setItem('navPinned', JSON.stringify(newPinnedState));
    };
    //  Can i pass a title to page nave from auth layout
    // can i get a way form outlet to bubble that up
    return (
        <div className="font-lato">
            <div title={title} />
            <div className={`drawer ${isNavPinned ? 'lg:drawer-open' : ''} `}>
                <div className="drawer-content flex flex-col border-l border-grey-1">
                    <main className="w-full min-h-screen bg-background flex flex-col">
                        <PageNav
                            showOpenMenu={!isNavPinned}
                            onShowNav={showNav}
                        />
                        <div className="grow">
                            {/* Needs to send data up to auth layout how to bubble up from outlet*/}
                            <Outlet />
                        </div>
                    </main>
                </div>
                <input
                    id="nav-drawer"
                    type="checkbox"
                    className="drawer-toggle"
                    checked={isNavOpen && !isNavPinned}
                    onChange={() => setIsNavOpen(!isNavOpen)}
                />
                <div className="!overflow-visible drawer-side">
                    <label
                        htmlFor="nav-drawer"
                        className="drawer-overlay"
                    ></label>
                    <Navbar onTogglePin={togglePin} isPinned={isNavPinned} />
                </div>
            </div>
        </div>
    );
}
