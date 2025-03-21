import { Section } from '@/Pages/ProgramOverviewDashboard';
import { TextOnlyModal } from './TextOnlyModal';
import { closeModal, TextModalType } from '.';
import { SectionStatusOptions } from '../SectionStatus';
import { forwardRef } from 'react';

export enum ModifySectionType {}

const ModifySectionModal = forwardRef(function (
    {
        action,
        section
    }: {
        action: SectionStatusOptions | undefined;
        section: Section;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    if (action === undefined) return;
    let title, text;
    switch (action) {
        case SectionStatusOptions.Complete:
            title = 'Mark as Complete';
            text = 'Mark this section as complete?';
            break;
        case SectionStatusOptions.Pause:
            title = 'Pause Section';
            text = `Are you sure you would like to pause this ${section.status.toLocaleLowerCase()} section?`;
            break;
        case SectionStatusOptions.Cancel:
            title = 'Cancel Section';
            text = `Are you sure you would like to cancel this ${section.status.toLocaleLowerCase()} section?`;
            break;
        // do we need to do one for schedule ??
        // do we need for mark as active ??
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
            // do we need to do one for schedule ??
            // do we need for mark as active ??
        }
        return;
    }
    function completeSection() {
        //
    }
    function pauseSection() {
        //
    }
    function cancelSection() {
        //
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
