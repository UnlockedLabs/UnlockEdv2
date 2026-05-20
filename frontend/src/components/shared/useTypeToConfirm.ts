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
        // Never match an empty expected value — otherwise dialogs that fall back
        // to an empty token (e.g. a missing resident doc_id) would skip the gate.
        matches: expected.length > 0 && value === expected,
        inputProps: {
            value,
            onChange: (e) => setValue(e.target.value)
        },
        reset: () => setValue('')
    };
}
