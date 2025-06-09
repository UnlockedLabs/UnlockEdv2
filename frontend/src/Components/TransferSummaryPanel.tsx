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
                            {resident?.user.name_last}
                            {', '}
                            {resident?.user.name_first}
                        </td>
                    </tr>
                    <tr>
                        <td className="font-bold text-right">Resident ID:</td>
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
                    The resident will be removed from {resident?.transfer_from}.
                </li>
                <li>
                    The resident will be unenrolled from all active classes and
                    programs.
                </li>
                {resident?.program_names &&
                    resident?.program_names.length != 0 && (
                        <>
                            <li>
                                The following programs are not available at the
                                new facility:
                                <ul className="list-disc list-outside pl-5">
                                    {resident?.program_names.map(
                                        (conflict, idx) => (
                                            <li
                                                key={idx}
                                            >{`${conflict.class_name} (Program: ${conflict.program_name})`}</li>
                                        )
                                    )}
                                </ul>
                            </li>
                        </>
                    )}
                <li>
                    The resident's account will be added to{' '}
                    {resident?.transfer_to}.
                </li>
                <li>
                    Staff must re-enroll resident in available programs at{' '}
                    {resident?.transfer_to}.
                </li>
                <li>
                    The resident's account history and favorites will be
                    preserved.
                </li>
            </ul>
            <div className="body py-4 inline-flex items-center gap-1 text-error">
                <ULIComponent
                    iconClassName="text-error"
                    icon={ExclamationTriangleIcon}
                />{' '}
                This action cannot be undone.
            </div>
        </>
    );
}
