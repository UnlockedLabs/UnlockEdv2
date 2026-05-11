import { ServerResponseMany, ServerResponseOne, ToastState } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useCallback } from 'react';
import { KeyedMutator } from 'swr';

interface UseCheckResponseProps<T> {
    mutate:
        | KeyedMutator<ServerResponseMany<T>>
        | KeyedMutator<ServerResponseOne<T>>;
    onSuccess?: () => void;
    closeDialog?: () => void;
}

export function useCheckResponse<T>({
    mutate,
    onSuccess,
    closeDialog
}: UseCheckResponseProps<T>) {
    const { toaster } = useToast();

    return useCallback(
        (status: boolean, errorMessage: string, successMessage: string) => {
            if (!status) {
                toaster(errorMessage, ToastState.error);
            } else {
                toaster(successMessage, ToastState.success);
                closeDialog?.();
                void mutate();
                onSuccess?.();
            }
        },
        [mutate, toaster, onSuccess, closeDialog]
    );
}
