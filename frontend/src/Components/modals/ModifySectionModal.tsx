import { TextOnlyModal } from './TextOnlyModal';
import { closeModal, TextModalType } from '.';
import { forwardRef } from 'react';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { KeyedMutator } from 'swr';
import {
    Section,
    SectionStatusMap,
    SectionStatusOptions,
    SelectedSectionStatus,
    ServerResponseMany
} from '@/common';

export const StatusMessagesMap = {
    [SectionStatusOptions.Complete]: {
        title: 'Mark as Complete',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} section as complete?`
    },
    [SectionStatusOptions.Pause]: {
        title: 'Pause Section',
        text: (status: string) =>
            `Are you sure you would like to pause this ${status.toLocaleLowerCase()} section?`
    },
    [SectionStatusOptions.Cancel]: {
        title: 'Cancel Section',
        text: (status: string) =>
            `Are you sure you would like to cancel this ${status.toLocaleLowerCase()} section?`
    },
    [SectionStatusOptions.Schedule]: {
        title: 'Mark as Scheduled',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} section as scheduled?`
    },
    [SectionStatusOptions.Active]: {
        title: 'Mark as Active',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} section as active?`
    }
};

const ModifySectionModal = forwardRef(function (
    {
        action,
        section,
        mutate,
        setSelectedStatus
    }: {
        action: SectionStatusOptions | undefined;
        section: Section;
        mutate: KeyedMutator<ServerResponseMany<Section>>;
        setSelectedStatus: React.Dispatch<
            React.SetStateAction<SelectedSectionStatus>
        >;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: ref
    });
    if (action === undefined) return;
    const { title, text } = StatusMessagesMap[action] || {};
    if (title === undefined || text === undefined) return;

    async function onConfirm() {
        const updatedStatus = SectionStatusMap[action!];
        setSelectedStatus(updatedStatus);

        const resp = await API.patch(`program-sections?id=${section.id}`, {
            status: updatedStatus
        });

        checkResponse(
            resp.success,
            'Unable to update section',
            'Section updated successfully'
        );
        return;
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
                text={text(section.status) ?? ''}
                onSubmit={() => void onConfirm()}
                onClose={close}
            />
        </div>
    );
});

export default ModifySectionModal;
