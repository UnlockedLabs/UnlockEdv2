import { Section } from '@/Pages/ProgramOverviewDashboard';
import { TextOnlyModal } from './TextOnlyModal';
import { closeModal, TextModalType } from '.';
import { SectionStatusOptions, SelectedSectionStatus } from '../SectionStatus';
import { forwardRef } from 'react';

export enum ModifySectionType {}

const ModifySectionModal = forwardRef(function (
    {
        action,
        section,
        setSelectedStatus
    }: {
        action: SectionStatusOptions | undefined;
        section: Section;
        setSelectedStatus: React.Dispatch<
            React.SetStateAction<SelectedSectionStatus>
        >;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    if (action === undefined) return;
    let title, text;
    switch (action) {
        case SectionStatusOptions.Complete:
            title = 'Mark as Complete';
            text = `Mark this ${section.status.toLocaleLowerCase()} section as complete?`;
            break;
        case SectionStatusOptions.Pause:
            title = 'Pause Section';
            text = `Are you sure you would like to pause this ${section.status.toLocaleLowerCase()} section?`;
            break;
        case SectionStatusOptions.Cancel:
            title = 'Cancel Section';
            text = `Are you sure you would like to cancel this ${section.status.toLocaleLowerCase()} section?`;
            break;
        case SectionStatusOptions.Schedule:
            title = 'Mark as Scheduled';
            text = `Mark this ${section.status.toLocaleLowerCase()} section as scheduled?`;
            break;
        case SectionStatusOptions.Active:
            title = 'Mark as Active';
            text = `Mark this ${section.status.toLocaleLowerCase()} section as active?`;
    }
    if (title === undefined || text === undefined) return;

    function onConfirm() {
        switch (action) {
            case SectionStatusOptions.Complete:
                completeSection();
                break;
            case SectionStatusOptions.Pause:
                pauseSection();
                break;
            case SectionStatusOptions.Cancel:
                cancelSection();
                break;
            case SectionStatusOptions.Schedule:
                scheduleSection();
                break;
            case SectionStatusOptions.Active:
                activeSection();
                break;
        }
        return;
    }
    function completeSection() {
        // API
        setSelectedStatus(SelectedSectionStatus.Completed);
    }
    function pauseSection() {
        // API
        setSelectedStatus(SelectedSectionStatus.Paused);
    }
    function cancelSection() {
        // API
        setSelectedStatus(SelectedSectionStatus.Canceled);
    }
    function scheduleSection() {
        // API
        setSelectedStatus(SelectedSectionStatus.Scheduled);
    }
    function activeSection() {
        // API
        setSelectedStatus(SelectedSectionStatus.Active);
    }
    function close() {
        closeModal(ref);
    }
    return (
        <div onClick={(e) => e.stopPropagation()}>
            <TextOnlyModal
                ref={ref}
                type={TextModalType.Confirm}
                title={title}
                text={text ?? ''}
                onSubmit={onConfirm}
                onClose={close}
            />
        </div>
    );
});

export default ModifySectionModal;
