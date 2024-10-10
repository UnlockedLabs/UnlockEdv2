import { useEffect, useRef } from 'react';
import { handleLogout, useAuth } from '@/useAuth';
import {
    ArrowRightEndOnRectangleIcon,
    Bars3Icon,
    HomeIcon
} from '@heroicons/react/24/solid';

import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

import ThemeToggle from './ThemeToggle';
import ULIComponent from '@/Components/ULIComponent.tsx';

export default function PageNav({
    path,
    showOpenMenu,
    onShowNav
}: {
    path: string[];
    showOpenMenu: boolean;
    onShowNav?: () => void;
}) {
    const { user } = useAuth();
    const detailsRef = useRef<HTMLDetailsElement>();
    useEffect(() => {
        const closeDropdown = ({ target }: MouseEvent) => {
            if (
                detailsRef.current &&
                !detailsRef.current?.contains(target as Node)
            ) {
                detailsRef.current.removeAttribute('open');
            }
        };

        window.addEventListener('click', closeDropdown);

        return () => {
            window.removeEventListener('click', closeDropdown);
        };
    }, []);

    return (
        <div className="navbar px-8">
            <div className="navbar-start breadcrumbs !py-0 pl-0">
                <ul>
                    {showOpenMenu ? (
                        <li>
                            <ULIComponent
                                onClick={() => {
                                    onShowNav;
                                }}
                                icon={Bars3Icon}
                                iconClassName={'cursor-pointer'}
                            />
                        </li>
                    ) : (
                        <li>
                            <ULIComponent
                                onClick={() => {
                                    onShowNav;
                                }}
                                icon={Bars3Icon}
                                iconClassName={'lg:hidden cursor-pointer'}
                            />
                            <ULIComponent
                                icon={HomeIcon}
                                iconClassName={'hidden lg:block'}
                            />
                        </li>
                    )}

                    {path && path.map((p) => <li key={p}>{p}</li>)}
                </ul>
            </div>
            <div className="navbar-end">
                <ul className="menu menu-horizontal px-1">
                    <li>
                        <details ref={detailsRef}>
                            <summary>
                                <span className="font-semibold text-left">
                                    {user.name_first} {user.name_last}
                                </span>
                            </summary>
                            <ul className="bg-base-300 z-[1]">
                                <li>
                                    <label className="flex cursor-pointer gap-2">
                                        <ULIComponent
                                            icon={SunIcon}
                                            iconClassName={'w-6 h-6'}
                                        />
                                        <ThemeToggle />
                                        <ULIComponent
                                            icon={MoonIcon}
                                            iconClassName={'w-6 h-6'}
                                        />
                                    </label>
                                </li>
                                <div className="divider mt-0 mb-0"></div>

                                <li>
                                    <button onClick={() => handleLogout()}>
                                        <ArrowRightEndOnRectangleIcon className="h-4" />
                                        Logout
                                    </button>
                                </li>
                            </ul>
                        </details>
                    </li>
                </ul>
            </div>
        </div>
    );
}
