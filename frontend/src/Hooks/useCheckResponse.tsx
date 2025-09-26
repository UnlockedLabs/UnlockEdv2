import { ServerResponseMany, ServerResponseOne, ToastState } from '@/common';
import { closeModal } from '@/Components/modals';
import { useToast } from '@/Context/ToastCtx';
import { useCallback } from 'react';
import { KeyedMutator } from 'swr';

interface UseCheckResponseProps<T> {
    mutate:
        | KeyedMutator<ServerResponseMany<T>>
        | KeyedMutator<ServerResponseOne<T>>;
    refModal: React.ForwardedRef<HTMLDialogElement>;
    onSuccess?: () => void;
}

export function useCheckResponse<T>({
    mutate,
    refModal,
    onSuccess
}: UseCheckResponseProps<T>) {
    const { toaster } = useToast();

    return useCallback(
        (status: boolean, errorMessage: string, successMessage: string) => {
            if (!status) {
                toaster(errorMessage, ToastState.error);
            } else {
                toaster(successMessage, ToastState.success);
                closeModal(refModal);
                void mutate();
                onSuccess?.();
            }
        },
        [mutate, refModal, toaster, onSuccess]
    );
}
