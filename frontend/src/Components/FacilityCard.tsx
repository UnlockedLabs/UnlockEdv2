// import { useNavigate } from 'react-router-dom';
import { Facility } from '@/common';
import ULIComponent from '@/Components/ULIComponent.tsx';
import {
    ArrowPathRoundedSquareIcon,
    PencilIcon,
    TrashIcon
} from '@heroicons/react/20/solid';

export default function FacilityCard({
    facility
    // openEditProvider,
    // oidcClient,
    // showAuthorizationInfo,
    // archiveProvider
}: {
    facility: Facility;
    // openEditProvider: (prov: ProviderPlatform) => void;
    // oidcClient: (prov: ProviderPlatform) => void;
    // showAuthorizationInfo: (prov: ProviderPlatform) => void;
    // archiveProvider: (prov: ProviderPlatform) => void;
}) {
    // const navigate = useNavigate();
    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-4 justify-items-center">
            <td className="justify-self-start">{facility.name}</td>
            <td className="">{facility.timezone}</td>
            <td className="flex flex-row gap-3 justify-self-end">
                <div className="flex space-x-2 text-accent cursor-pointer">
                    <ULIComponent
                        dataTip={'Edit Student'}
                        icon={PencilIcon}
                        onClick={() => {
                            // setTargetUser(user);
                            // editUserModal.current?.showModal();
                        }}
                    />

                    <ULIComponent
                        dataTip={'Reset Password'}
                        icon={ArrowPathRoundedSquareIcon}
                        onClick={() => {
                            // setTargetUser(user);
                            // resetUserPasswordModal.current?.showModal();
                        }}
                    />

                    <ULIComponent
                        dataTip={'Delete Student'}
                        icon={TrashIcon}
                        onClick={() => {
                            // setTargetUser(user);
                            // deleteUserModal.current?.showModal();
                        }}
                    />
                </div>
            </td>
        </tr>
    );
}
