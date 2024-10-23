import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/useAuth';
import {
    Bars3Icon,
    BuildingOffice2Icon,
    HomeIcon
} from '@heroicons/react/24/solid';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { usePathValue } from '@/PathValueCtx';
import { Facility, UserRole } from '@/common';
import { useLoaderData } from 'react-router-dom';
import API from '@/api/api';

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
    const facilityNames = useLoaderData() as Facility[] | null;

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

    const handleSwitchFacility = async (facility: Facility) => {
        const resp = await API.put(`admin/facility-context/${facility.id}`, {});
        if (resp.success) {
            window.location.reload();
        }
    };

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
            {user?.role == UserRole.Admin ? (
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
                                        <label>{facility.name}</label>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </li>
                </ul>
            ) : (
                <div className="flex flex-row items-center gap-2 px-6 py-4">
                    <ULIComponent icon={BuildingOffice2Icon} />
                    <label className="font-semibold">
                        {user?.facility_name}
                    </label>
                </div>
            )}
        </div>
    );
}
