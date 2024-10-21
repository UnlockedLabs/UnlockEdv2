import { useEffect, useRef, useState } from 'react';
import { handleLogout, useAuth } from '@/useAuth';
import {
    ArrowRightEndOnRectangleIcon,
    Bars3Icon,
    HomeIcon
} from '@heroicons/react/24/solid';

import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

import ThemeToggle from './ThemeToggle';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { usePathValue } from '@/PathValueCtx';

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
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const { pathVal } = usePathValue();
    const [customPath, setCustomPath] = useState<string[]>(path ?? []);

    useEffect(() => {
        const handlePathChange = () => {
            const newPath = [...path];
            if (newPath && newPath.length > 0) {
                setCustomPath(
                    newPath.map((p) => {
                        return (
                            pathVal?.find((pv) => pv.path_id === p)?.value ?? p
                        );
                    })
                );
                return;
            }
            setCustomPath(path);
        };
        handlePathChange();
    }, [path, pathVal]);

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
        <div className="px-8 flex justify-between items-center">
            <div className="breadcrumbs">
                <ul>
                    {showOpenMenu ? (
                        <li>
                            <ULIComponent
                                onClick={() => {
                                    if (onShowNav) onShowNav();
                                }}
                                icon={Bars3Icon}
                                iconClassName={'cursor-pointer'}
                            />
                        </li>
                    ) : (
                        <li>
                            <ULIComponent
                                onClick={() => {
                                    if (onShowNav) onShowNav();
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

                    {customPath?.map((p) => (
                        <li className="capitalize" key={p}>
                            {p}
                        </li>
                    ))}
                </ul>
            </div>
            <ul className="menu menu-horizontal px-1">
                <li>
                    <details className="dropdown dropdown-end" ref={detailsRef}>
                        <summary>
                            {user && (
                                <span className="font-semibold">
                                    {user.name_first} {user.name_last}
                                </span>
                            )}
                        </summary>
                        <ul className="dropdown-content bg-grey-2 z-[1] dark:bg-grey-1">
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
                                <button
                                    onClick={() => {
                                        void handleLogout();
                                    }}
                                >
                                    <ArrowRightEndOnRectangleIcon className="h-4" />
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </details>
                </li>
            </ul>
        </div>
    );
}
