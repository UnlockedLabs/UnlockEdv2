import { Facility } from '@/common';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function FacilityCard({
    facility,
    openEditFacility,
    openDeleteFacility
}: {
    facility: Facility;
    openEditFacility: (fac: Facility) => void;
    openDeleteFacility: (fac: Facility) => void;
}) {
    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-3 justify-items-center">
            <td className="justify-self-start">{facility.name}</td>
            <td className="">{facility.timezone}</td>
            <td className="flex flex-row gap-3 justify-self-end">
                <div className="flex space-x-2 cursor-pointer">
                    <ULIComponent
                        dataTip={'Edit Facility'}
                        icon={PencilSquareIcon}
                        onClick={() => {
                            openEditFacility(facility);
                        }}
                    />

                    <ULIComponent
                        dataTip={'Delete Facility'}
                        icon={TrashIcon}
                        onClick={() => {
                            openDeleteFacility(facility);
                        }}
                    />
                </div>
            </td>
        </tr>
    );
}
