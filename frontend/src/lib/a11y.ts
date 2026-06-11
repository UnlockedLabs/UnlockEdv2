import { KeyboardEvent } from 'react';

export function clickableProps(onActivate: () => void) {
    return {
        role: 'button',
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
            }
        }
    };
}
