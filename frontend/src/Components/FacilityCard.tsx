import { Facility } from '@/common';
import ULIComponent from '@/Components/ULIComponent.tsx';
import {
    PencilSquareIcon,
    TrashIcon,
    LockClosedIcon
} from '@heroicons/react/24/outline';
import { isSysAdmin, useAuth } from '@/useAuth';

export default function FacilityCard({
    facility,
    openEditFacility,
    openDeleteFacility
}: {
    facility: Facility;
    openEditFacility: (fac: Facility) => void;
    openDeleteFacility: (fac: Facility) => void;
}) {
    const { user } = useAuth();
    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-3 justify-items-center">
            <td className="justify-self-start">{facility.name}</td>
            <td className="">{facility.timezone}</td>
            <td className="flex flex-row gap-3 justify-self-end cursor-pointer">
                {user && !isSysAdmin(user) ? (
                    <ULIComponent
                        dataTip={
                            'Only UnlockEd staff can currently delete or edit facilities'
                        }
                        tooltipClassName="tooltip-left cursor-pointer"
                        icon={LockClosedIcon}
                    />
                ) : (
                    <>
                        <ULIComponent
                            dataTip={'Delete Facility'}
                            icon={TrashIcon}
                            onClick={() => {
                                openDeleteFacility(facility);
                            }}
                            tooltipClassName="tooltip-left"
                        />
                        <ULIComponent
                            dataTip={'Edit Facility'}
                            icon={PencilSquareIcon}
                            onClick={() => {
                                openEditFacility(facility);
                            }}
                        />
                    </>
                )}
            </td>
        </tr>
    );
}
