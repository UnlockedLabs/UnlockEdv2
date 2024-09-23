import { PropsWithChildren, useState } from 'react';
import Navbar from '@/Components/Navbar';
import PageNav from '@/Components/PageNav';

export default function AuthenticatedLayout({
    title,
    path,
    children
}: PropsWithChildren<{ title: string; path?: Array<string> }>) {
    // We have three states we need to factor for.
    // 1. If the nav is open & pinned (Large screens only & uses lg:drawer-open)
    // 2. If the nav is open & not pinned (Large screens only)
    // 3. If the nav is not open. (Small screens only)

    const getInitialPinnedState = () => {
        const storedNavPinned = localStorage.getItem('navPinned');
        return storedNavPinned ? JSON.parse(storedNavPinned) : true;
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

    return (
        <div className="font-lato">
            <div title={title} />
            <div
                className={`drawer drawer-mobile  ${isNavPinned ? 'lg:drawer-open' : ''} `}
            >
                <div className="drawer-content flex flex-col border-l border-grey-1">
                    <main className="w-full min-h-screen bg-background flex flex-col">
                        <PageNav
                            path={path}
                            showOpenMenu={!isNavPinned}
                            onShowNav={showNav}
                        />
                        <div className="grow">{children}</div>
                    </main>
                </div>
                <input
                    id="nav-drawer"
                    type="checkbox"
                    className="drawer-toggle"
                    checked={isNavOpen && !isNavPinned}
                    onChange={() => setIsNavOpen(!isNavOpen)}
                />
                <div className="drawer-side">
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
