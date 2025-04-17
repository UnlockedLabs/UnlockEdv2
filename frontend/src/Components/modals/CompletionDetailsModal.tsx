import { ProgramCompletion } from '@/common';
import { TextOnlyModal } from '@/Components/modals/TextOnlyModal';
import { TextModalType } from '.';

export default function CompletionDetailsModal({
    enrollment: completionDetails,
    modalRef,
    onClose
}: {
    enrollment: ProgramCompletion | null;
    modalRef: React.RefObject<HTMLDialogElement>;
    onClose: () => void;
}) {
    return (
        <TextOnlyModal
            ref={modalRef}
            type={TextModalType.Information}
            title="Completion Details"
            onSubmit={onClose}
            onClose={() => {
                if (modalRef.current) {
                    modalRef.current.close();
                }
            }}
            text={
                completionDetails ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-2">
                            <h3 className="text-md font-semibold border-b pb-1">
                                User Information
                            </h3>
                            <p>
                                <span className="font-semibold">Name:</span>{' '}
                                {`${completionDetails.user?.name_last}, ${completionDetails.user?.name_first}`}
                            </p>
                            <p>
                                <span className="font-semibold">
                                    Resident ID:
                                </span>{' '}
                                {completionDetails.user?.doc_id}
                            </p>
                            <p>
                                <span className="font-semibold">Facility:</span>{' '}
                                {completionDetails.facility_name}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-md font-semibold border-b pb-1">
                                Completed Program
                            </h3>
                            <p>
                                <span className="font-semibold">Program:</span>{' '}
                                {completionDetails.program_name}
                            </p>
                            <p>
                                <span className="font-semibold">Class:</span>{' '}
                                {completionDetails.program_class_name}
                            </p>
                            <p>
                                <span className="font-semibold">
                                    Program Owner:
                                </span>{' '}
                                {completionDetails.program_owner ?? 'n/a'}
                            </p>
                            <p>
                                <span className="font-semibold">
                                    Credit Type:
                                </span>{' '}
                                {completionDetails.credit_type}
                            </p>
                            <p>
                                <span className="font-semibold">
                                    Start Date:
                                </span>{' '}
                                {new Date(
                                    completionDetails.program_class_start_dt
                                ).toLocaleDateString()}
                            </p>
                            <p>
                                <span className="font-semibold">
                                    Graduated By:
                                </span>{' '}
                                {completionDetails.admin_email}
                            </p>
                        </div>
                    </div>
                ) : (
                    'Loading details...'
                )
            }
        />
    );
}
