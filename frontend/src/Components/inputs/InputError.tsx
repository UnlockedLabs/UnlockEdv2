import { HTMLAttributes } from 'react';

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <div
            {...props}
            className={'text-sm text-error dark:text-red-400 ' + className}
        >
            {message}
        </div>
    ) : undefined;
}
