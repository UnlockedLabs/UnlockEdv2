import { useEffect, useRef } from 'react';
import { useAuth, canSwitchFacility, AUTHCALLBACK } from '@/useAuth';
import { Bars3Icon, BuildingOffice2Icon } from '@heroicons/react/24/solid';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { Facility, RouteTitleHandler, TitleHandler } from '@/common';
import { useMatches } from 'react-router-dom';
import API from '@/api/api';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { resolveTitle } from '@/routeLoaders';

export default function PageNav({
    showOpenMenu,
    onShowNav,
    facilities
}: {
    showOpenMenu: boolean;
    onShowNav?: () => void;
    facilities?: Facility[];
}) {
    const { user } = useAuth();
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const matches = useMatches();
    const currentRoute = matches[matches.length - 1];
    const routeData = currentRoute?.data as TitleHandler;
    const routeHandle = currentRoute?.handle as RouteTitleHandler<TitleHandler>;
    const pageTitle = resolveTitle(routeHandle, routeData);
    const { pageTitle: authLayoutPageTitle, setPageTitle } = usePageTitle();
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

    useEffect(() => {
        if (pageTitle) {
            setPageTitle(pageTitle);
        }
    }, [pageTitle, setPageTitle]);

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
        <div className="px-2 py-3 flex justify-between items-center">
            <div
                className={`flex items-center gap-3 ${showOpenMenu ? 'px-3' : ''}`}
            >
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
                <h1>
                    {pageTitle == 'Library Viewer'
                        ? authLayoutPageTitle
                        : pageTitle}
                </h1>
            </div>
            {user && canSwitchFacility(user) ? (
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
                                {facilities?.map((facility: Facility) => (
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
