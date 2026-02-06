import { useEffect, useRef } from 'react';
import { useAuth, canSwitchFacility } from '@/useAuth';
import { Bars3Icon, BuildingOffice2Icon } from '@heroicons/react/24/solid';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { Facility, RouteTitleHandler, TitleHandler, UserRole } from '@/common';
import { useMatches } from 'react-router-dom';
import API from '@/api/api';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { useBreadcrumb } from '@/Context/BreadcrumbContext';
import { useBreadcrumbsFromRoutes } from '@/Hooks/useBreadcrumbsFromRoutes';
import { resolveTitle } from '@/routeLoaders';
import Breadcrumb from './Breadcrumb';

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
    const { breadcrumbItems: contextBreadcrumbs } = useBreadcrumb();
    const routeBreadcrumbs = useBreadcrumbsFromRoutes();
    const breadcrumbItems =
        routeBreadcrumbs.length > 0 ? routeBreadcrumbs : contextBreadcrumbs;

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
            const params = new URLSearchParams(window.location.search);
            if (params.get('page') !== null) {
                params.set('page', '1');
            }
            const paramsString = params.size > 0 ? '?' + params.toString() : '';
            window.location.href = window.location.pathname + paramsString;
        }
    };

    const path = window.location.pathname;
    const FacilityDropdownToggle = () => {
        return (
            <ul className="menu menu-horizontal px-1">
                <li>
                    <details className="dropdown dropdown-end" ref={detailsRef}>
                        <summary>
                            <ULIComponent icon={BuildingOffice2Icon} />
                            <span className="font-semibold">
                                {user?.facility.name}
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
        );
    };

    return (
        <div className="px-5 py-3 flex justify-between items-center">
            <div
                className={`flex flex-col gap-1 ${showOpenMenu ? 'px-3' : ''}`}
            >
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
                </div>
                {breadcrumbItems.length > 0 ? (
                    <div className={showOpenMenu ? '' : 'lg:pl-0 pl-9'}>
                        <Breadcrumb items={breadcrumbItems} />
                    </div>
                ) : (
                    <h1 className={showOpenMenu ? '' : 'lg:pl-0 pl-9'}>
                        {pageTitle === 'Library Viewer'
                            ? authLayoutPageTitle
                            : pageTitle}
                    </h1>
                )}
            </div>
            {user && canSwitchFacility(user) && path !== '/programs' ? (
                <FacilityDropdownToggle />
            ) : (
                <div className="flex flex-row items-center gap-2 px-6 py-4">
                    <ULIComponent icon={BuildingOffice2Icon} />
                    <label className="font-semibold body">
                        {user?.role === UserRole.DepartmentAdmin ||
                        user?.role === UserRole.SystemAdmin
                            ? 'All Facilities'
                            : user?.facility.name}
                    </label>
                </div>
            )}
        </div>
    );
}
