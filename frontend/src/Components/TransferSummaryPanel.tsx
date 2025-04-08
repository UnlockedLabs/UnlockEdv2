import ULIComponent from './ULIComponent';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ValidResident } from '@/common';

export default function TransferSummaryPanel({
    resident
}: {
    resident?: ValidResident;
}) {
    return (
        <>
            <table className="body">
                <tbody>
                    <tr>
                        <td className="font-bold text-right">Resident Name:</td>
                        <td>
                            {resident?.user.name_first}{' '}
                            {resident?.user.name_last}
                        </td>
                    </tr>
                    <tr>
                        <td className="font-bold text-right">ID:</td>
                        <td>{resident?.user.doc_id}</td>
                    </tr>
                    <tr>
                        <td className="font-bold text-right">
                            Current Facility:
                        </td>
                        <td>{resident?.transfer_from}</td>
                    </tr>
                    <tr>
                        <td className="font-bold text-right">New Facility:</td>
                        <td>{resident?.transfer_to}</td>
                    </tr>
                </tbody>
            </table>
            <p className="body font-bold py-2">
                You are about to transfer this resident's account.
            </p>
            <ul className="body list-disc list-outside pl-5">
                <li>
                    Resident account will be removed from the current facility.
                </li>
                <li>
                    Resident will no longer be enrolled in any active classes or
                    programs.
                </li>
                {resident?.program_names &&
                    resident?.program_names.length != 0 && (
                        <>
                            <li>
                                Resident is enrolled in the following classes
                                not offered at the new facility:
                                <ul className="list-disc list-outside pl-5">
                                    {resident?.program_names.map((name) => (
                                        <li key={name}>{name}</li>
                                    ))}
                                </ul>
                            </li>
                        </>
                    )}
                <li>Resident account will be added to the new facility.</li>
                <li>
                    Staff must re-enroll resident in available programs at new
                    facility.
                </li>
                <li>Account history will remain on the resident profile.</li>
                <li>Resident favorites and history will be saved.</li>
            </ul>
            <div className="body py-4 inline-flex items-center gap-1">
                <ULIComponent icon={ExclamationTriangleIcon} /> This action
                cannot be undone.
            </div>
        </>
    );
}
