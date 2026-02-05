import { useEffect, useRef, useState } from 'react';
import { KeyedMutator } from 'swr';
import { closeModal, showModal, TextModalType, TextOnlyModal } from './modals';
import API from '@/api/api';
import ModifyProgramModal from './modals/ModifyProgramModal';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import {
    ProgramsOverviewTable,
    ServerResponseMany,
    ProgramEffectiveStatus,
    ProgramAction,
    ServerResponseOne,
    ToastState
} from '@/common';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import ULIComponent from '@/Components/ULIComponent';
import { useToast } from '@/Context/ToastCtx';
import { CancelButton } from './inputs';

function ProgramStatusPill({
    status,
    closed
}: {
    status: ProgramEffectiveStatus;
    closed: boolean;
}) {
    let background: string, text: string;
    switch (status) {
        case ProgramEffectiveStatus.Available:
            background = 'bg-[#B0DFDA] text-[#002E2A]';
            text = 'Available';
            break;
        case ProgramEffectiveStatus.Inactive:
            background = 'bg-grey-2 text-body-text';
            text = 'Inactive';
            break;
        case ProgramEffectiveStatus.Archived:
            background = 'bg-grey-2 text-body-text';
            text = 'Archived';
            break;
    }
    return (
        <div
            className={`inline-flex items-center gap-1 catalog-pill mx-0 w-full justify-between ${background} ${
                closed ? '' : 'cursor-pointer'
            }`}
        >
            <span>{text}</span>
            {!closed && <ULIComponent icon={ChevronDownIcon} />}
        </div>
    );
}

function getEffectiveStatus(
    program: ProgramsOverviewTable
): ProgramEffectiveStatus {
    if (program.archived_at !== null) {
        return ProgramEffectiveStatus.Archived;
    } else if (program.status) {
        return ProgramEffectiveStatus.Available;
    } else {
        return ProgramEffectiveStatus.Inactive;
    }
}

export default function ProgramStatus({
    program,
    mutate
}: {
    program: ProgramsOverviewTable;
    mutate: KeyedMutator<ServerResponseMany<ProgramsOverviewTable>>;
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const effectiveStatus = getEffectiveStatus(program);
    const modifyProgramRef = useRef<HTMLDialogElement>(null);
    const cannotArchiveRef = useRef<HTMLDialogElement>(null);
    const [selectedAction, setSelectedAction] = useState<ProgramAction | null>(
        null
    );
    const [archiveFacilities, setArchiveFacilities] = useState<string[]>([]);
    const [archiveCheckLoading, setArchiveCheckLoading] = useState(false);
    const { toaster } = useToast();

    const checkResponse = useCheckResponse({
        mutate,
        refModal: modifyProgramRef
    });

    const programActions = new Map<ProgramEffectiveStatus, ProgramAction[]>([
        [ProgramEffectiveStatus.Available, ['set_inactive', 'archive']],
        [ProgramEffectiveStatus.Inactive, ['set_available', 'archive']],
        [ProgramEffectiveStatus.Archived, ['reactivate']]
    ]);
    const availableActions = programActions.get(effectiveStatus) ?? [];

    function openSelectionModal(action: ProgramAction) {
        setDropdownOpen(false);
        if (action === 'archive') {
            void handleArchiveCheck();
            return;
        }
        setSelectedAction(action);
    }

    useEffect(() => {
        if (selectedAction) {
            showModal(modifyProgramRef);
        }
    }, [selectedAction]);

    interface UpdateStatusResponse {
        updated: boolean;
        facilities: string[];
        message: string;
    }

    interface ArchiveCheckResponse {
        facilities: string[];
    }

    async function handleArchiveCheck() {
        if (archiveCheckLoading) return;
        setArchiveCheckLoading(true);
        const resp = (await API.get<ArchiveCheckResponse>(
            `programs/${program.program_id}/archive-check`
        )) as ServerResponseOne<ArchiveCheckResponse>;
        setArchiveCheckLoading(false);

        if (!resp.success) {
            toaster(
                resp.message || 'Unable to check active class status.',
                ToastState.error
            );
            return;
        }

        const facilities = resp.data.facilities ?? [];
        if (facilities.length > 0) {
            setArchiveFacilities(facilities);
            showModal(cannotArchiveRef);
            return;
        }

        setSelectedAction('archive');
    }

    async function handleConfirm(newStatus?: boolean) {
        const body: Record<string, unknown> = {};
        if (selectedAction === 'set_available') {
            body.is_active = true;
        } else if (selectedAction === 'set_inactive') {
            body.is_active = false;
        } else if (selectedAction === 'archive') {
            body.archived_at = new Date().toISOString();
        } else if (selectedAction === 'reactivate') {
            body.archived_at = null;
            body.is_active = newStatus;
        }

        const resp = (await API.patch<UpdateStatusResponse, typeof body>(
            `programs/${program.program_id}/status`,
            body
        )) as ServerResponseOne<UpdateStatusResponse>;

        if (resp.success) {
            const list = resp.data.facilities?.join(', ');
            checkResponse(
                resp.data.updated,
                `Cannot archive: active or scheduled classes still exist at: ${list}`,
                resp.data.message
            );
        }
    }

    const facilityCount = archiveFacilities.length;
    const facilityLabel = facilityCount === 1 ? 'facility' : 'facilities';
    const visibleFacilities = archiveFacilities.slice(0, 3);
    const remainingCount = facilityCount - visibleFacilities.length;

    function closeCannotArchiveModal() {
        setArchiveFacilities([]);
        closeModal(cannotArchiveRef);
    }

    return (
        <>
            <div
                className="relative"
                onClick={(e) => {
                    setDropdownOpen(!dropdownOpen);
                    e.stopPropagation();
                }}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDropdownOpen(false);
                    }
                }}
                tabIndex={0}
            >
                <ProgramStatusPill
                    status={effectiveStatus}
                    closed={availableActions.length === 0}
                />
                {dropdownOpen && (
                    <ul className="absolute left-0 bg-inner-background rounded-box shadow-lg p-2 overflow-y-auto z-10 w-full">
                        {availableActions.map((action) => (
                            <li key={action} className="w-full">
                                <div
                                    className="flex items-center space-x-2 px-2 py-1 hover:bg-grey-2 rounded cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openSelectionModal(action);
                                    }}
                                >
                                    <span className="text-sm">
                                        {action === 'set_available'
                                            ? 'Available'
                                            : action === 'set_inactive'
                                              ? 'Inactive'
                                              : action === 'archive'
                                                ? 'Archive'
                                                : 'Reactivate'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ModifyProgramModal
                ref={modifyProgramRef}
                action={selectedAction}
                program={program}
                onConfirm={(newStatus) => void handleConfirm(newStatus)}
                onClose={() => setSelectedAction(null)}
            />
            <div
                className="cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                <TextOnlyModal
                    ref={cannotArchiveRef}
                    type={TextModalType.Information}
                    title={`Cannot Archive ${program.program_name}`}
                    onSubmit={closeCannotArchiveModal}
                    onClose={closeCannotArchiveModal}
                    text={
                        <div className="flex flex-col gap-4">
                            <p className="body text-grey-4">
                                This program has active or scheduled classes in{' '}
                                {facilityCount} {facilityLabel}. You must
                                complete or cancel all associated classes before
                                archiving.
                            </p>
                            <div className="flex flex-col gap-2">
                                <span className="font-semibold">
                                    Currently scheduled in:
                                </span>
                                <ul className="list-disc pl-5 text-sm text-grey-4">
                                    {visibleFacilities.map((facility) => (
                                        <li key={facility}>{facility}</li>
                                    ))}
                                </ul>
                                {remainingCount > 0 && (
                                    <span className="text-sm text-grey-4">
                                        ...and {remainingCount} more.
                                    </span>
                                )}
                            </div>
                        </div>
                    }
                >
                    <div className="flex justify-end">
                        <CancelButton
                            onClick={closeCannotArchiveModal}
                            label="Close"
                        />
                    </div>
                </TextOnlyModal>
            </div>
        </>
    );
}
