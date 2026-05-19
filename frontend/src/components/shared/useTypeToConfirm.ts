import { useEffect, useState, ChangeEvent } from 'react';

interface UseTypeToConfirmOptions {
    open: boolean;
    expected: string;
}

interface UseTypeToConfirmResult {
    value: string;
    matches: boolean;
    inputProps: {
        value: string;
        onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    };
    reset: () => void;
}

/**
 * Tracks the typed pattern used by confirm by typing dialogs.
 */
export function useTypeToConfirm({
    open,
    expected
}: UseTypeToConfirmOptions): UseTypeToConfirmResult {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (!open) setValue('');
    }, [open]);

    return {
        value,
        matches: value === expected,
        inputProps: {
            value,
            onChange: (e) => setValue(e.target.value)
        },
        reset: () => setValue('')
    };
}
