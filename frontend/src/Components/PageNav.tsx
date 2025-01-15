import { useState, useEffect, useRef } from 'react';
import { isAdministrator, useAuth } from '@/useAuth';
import { Bars3Icon, BuildingOffice2Icon } from '@heroicons/react/24/solid';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { Facility, TitleHandler } from '@/common';
import { useMatches, useLoaderData } from 'react-router-dom';
import API from '@/api/api';

let setGlobalPageTitle: (newTitle: string) => void;

export default function PageNav({
    showOpenMenu,
    onShowNav
}: {
    showOpenMenu: boolean;
    onShowNav?: () => void;
}) {
    const { user } = useAuth();
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const facilityNames = useLoaderData() as Facility[] | null;
    const matches = useMatches();
    const currentRoute = matches[matches.length - 1];
    const pageTitle = (currentRoute?.handle as TitleHandler)?.title;
    const [globalPageTitle, _setGlobalPageTitle] = useState<string>(
        pageTitle || 'Library Viewer'
    );
    setGlobalPageTitle = _setGlobalPageTitle;

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

    const handleSwitchFacility = async (facility: Facility) => {
        const resp = await API.put<null, object>(
            `admin/facility-context/${facility.id}`,
            {}
        );
        if (resp.success) {
            window.location.reload();
        }
    };

    return (
        <div className="px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                {showOpenMenu ? (
                    <ULIComponent
                        onClick={onShowNav}
                        icon={Bars3Icon}
                        iconClassName="cursor-pointer"
                    />
                ) : (
                    <ULIComponent
                        onClick={onShowNav}
                        icon={Bars3Icon}
                        iconClassName="lg:hidden cursor-pointer"
                    />
                )}
                <h1 className="text-2xl font-lexend font-semibold">
                    {pageTitle == 'Library Viewer'
                        ? globalPageTitle
                        : pageTitle}
                </h1>
            </div>
            {user && isAdministrator(user) ? (
                <ul className="menu menu-horizontal px-1">
                    <li>
                        <details
                            className="dropdown dropdown-end"
                            ref={detailsRef}
                        >
                            <summary>
                                <ULIComponent icon={BuildingOffice2Icon} />
                                <span className="font-semibold">
                                    {user.facility_name}
                                </span>
                            </summary>
                            <ul className="dropdown-content w-max bg-grey-2 z-[1] dark:bg-grey-1 flex flex-col">
                                {facilityNames?.map((facility: Facility) => (
                                    <li
                                        key={facility.id}
                                        onClick={() => {
                                            void handleSwitchFacility(facility);
                                        }}
                                    >
                                        <label className="body">
                                            {facility.name}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </li>
                </ul>
            ) : (
                <div className="flex flex-row items-center gap-2 px-6 py-4">
                    <ULIComponent icon={BuildingOffice2Icon} />
                    <label className="font-semibold body">
                        {user?.facility_name}
                    </label>
                </div>
            )}
        </div>
    );
}
export { setGlobalPageTitle };
