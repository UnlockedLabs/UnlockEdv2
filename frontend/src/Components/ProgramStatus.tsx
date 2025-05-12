import { useEffect, useRef, useState } from 'react';
import { KeyedMutator } from 'swr';
import { showModal } from './modals';
import API from '@/api/api';
import ModifyProgramModal from './modals/ModifyProgramModal';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import {
    ProgramsOverviewTable,
    ServerResponseMany,
    ProgramEffectiveStatus,
    ProgramAction,
    ServerResponseOne
} from '@/common';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import ULIComponent from '@/Components/ULIComponent';

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
    const [selectedAction, setSelectedAction] = useState<ProgramAction | null>(
        null
    );

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
        setSelectedAction(action);
        setDropdownOpen(false);
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
                onConfirm={() => void handleConfirm()}
                onClose={() => setSelectedAction(null)}
            />
        </>
    );
}
