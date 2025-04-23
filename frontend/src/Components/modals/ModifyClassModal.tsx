import { TextOnlyModal } from './TextOnlyModal';
import { closeModal, TextModalType } from '.';
import { forwardRef } from 'react';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { KeyedMutator } from 'swr';
import {
    Class,
    ClassStatusMap,
    ClassStatusOptions,
    SelectedClassStatus,
    ServerResponseMany
} from '@/common';

export const StatusMessagesMap = {
    [ClassStatusOptions.Complete]: {
        title: 'Mark as Complete',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} class as complete?`
    },
    [ClassStatusOptions.Pause]: {
        title: 'Pause Class',
        text: (status: string) =>
            `Are you sure you would like to pause this ${status.toLocaleLowerCase()} class?`
    },
    [ClassStatusOptions.Cancel]: {
        title: 'Cancel Class',
        text: (status: string) =>
            `Are you sure you would like to cancel this ${status.toLocaleLowerCase()} class?`
    },
    [ClassStatusOptions.Schedule]: {
        title: 'Mark as Scheduled',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} class as scheduled?`
    },
    [ClassStatusOptions.Active]: {
        title: 'Mark as Active',
        text: (status: string) =>
            `Mark this ${status.toLocaleLowerCase()} class as active?`
    }
};

const ModifyClassModal = forwardRef(function (
    {
        action,
        program_class,
        mutate,
        setSelectedStatus
    }: {
        action: ClassStatusOptions | undefined;
        program_class: Class;
        mutate: KeyedMutator<ServerResponseMany<Class>>;
        setSelectedStatus: React.Dispatch<
            React.SetStateAction<SelectedClassStatus>
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
        const updatedStatus = ClassStatusMap[action!];

        const resp = await API.patch(`program-classes?id=${program_class.id}`, {
            status: updatedStatus
        });
        if (resp.success) setSelectedStatus(updatedStatus);

        checkResponse(
            resp.success,
            'Unable to update class',
            'Class updated successfully'
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
                text={text(program_class.status) ?? ''}
                onSubmit={() => void onConfirm()}
                onClose={close}
            />
        </div>
    );
});

export default ModifyClassModal;
