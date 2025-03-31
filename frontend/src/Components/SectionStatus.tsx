import { useEffect, useRef, useState } from 'react';
import ULIComponent from './ULIComponent';
import {
    CheckCircleIcon,
    ChevronDownIcon,
    ClockIcon,
    PauseCircleIcon,
    PresentationChartLineIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import ModifySectionModal from './modals/ModifySectionModal';
import { showModal } from './modals';
import {
    Section,
    SectionStatusMap,
    SectionStatusOptions,
    SelectedSectionStatus,
    ServerResponseMany
} from '@/common';
import { KeyedMutator } from 'swr';

export function isArchived(section: Section) {
    if (
        section.archived_at === null ||
        section.archived_at === '0001-01-01T00:00:00Z'
    )
        return false;
    return true;
}

function SelectedSectionStatusPill({
    archived,
    status
}: {
    archived: boolean;
    status: SelectedSectionStatus;
}) {
    let icon, background;

    switch (status) {
        case SelectedSectionStatus.Completed:
            icon = CheckCircleIcon;
            background = 'bg-[#DDFFCD] text-[#408D1C]';
            break;
        case SelectedSectionStatus.Canceled:
            icon = XCircleIcon;
            background = 'bg-[#FFDFDF] text-[#CA0000]';
            break;
        case SelectedSectionStatus.Paused:
            icon = PauseCircleIcon;
            background = 'bg-grey-2 text-body-text';
            break;
        case SelectedSectionStatus.Scheduled:
            icon = ClockIcon;
            background = 'bg-[#FFF3D4] text-[#ECAA00]';
            break;
        case SelectedSectionStatus.Active:
            icon = PresentationChartLineIcon;
            background = 'bg-[#B0DFDA] text-[#002E2A]';
    }

    if (!icon || !background) return;

    return (
        <div
            className={`inline-flex items-center gap-1 catalog-pill mx-0 w-full justify-between ${background}`}
        >
            <ULIComponent icon={icon} />
            <span>{status}</span>
            {archived ? <div></div> : <ULIComponent icon={ChevronDownIcon} />}
        </div>
    );
}

export default function SectionStatus({
    section,
    status,
    mutateSections
}: {
    section: Section;
    status: SelectedSectionStatus;
    mutateSections: KeyedMutator<ServerResponseMany<Section>>;
}) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(status);
    const modifySectionRef = useRef<HTMLDialogElement>(null);
    const [selectedModifyOption, setSelectedModifyOption] =
        useState<SectionStatusOptions>();

    function openSelectionModal(
        e: React.MouseEvent<HTMLDivElement, MouseEvent>,
        option: SectionStatusOptions
    ) {
        if (isArchived(section)) return;
        setDropdownOpen(false);
        setSelectedModifyOption(option);
        e.stopPropagation();
    }

    useEffect(() => {
        showModal(modifySectionRef);
    }, [selectedModifyOption]);

    return (
        <>
            <div
                className="relative"
                onClick={(e) => {
                    if (isArchived(section)) return;
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
                <SelectedSectionStatusPill
                    archived={isArchived(section)}
                    status={selectedStatus}
                />
                {dropdownOpen && (
                    <ul
                        className="absolute left-0 bg-inner-background rounded-box shadow-lg p-2 overflow-y-auto z-10 w-full"
                        tabIndex={0}
                    >
                        {Object.values(SectionStatusOptions).map((option) => {
                            if (SectionStatusMap[option] === selectedStatus)
                                return null;

                            return (
                                <li key={option} className="w-full">
                                    <div
                                        className="flex items-center space-x-2 px-2 py-1 hover:bg-grey-2 rounded cursor-pointer"
                                        onClick={(e) =>
                                            openSelectionModal(e, option)
                                        }
                                    >
                                        <span className="text-sm">
                                            {option}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <ModifySectionModal
                ref={modifySectionRef}
                action={selectedModifyOption}
                section={section}
                mutate={mutateSections}
                setSelectedStatus={setSelectedStatus}
            />
        </>
    );
}
