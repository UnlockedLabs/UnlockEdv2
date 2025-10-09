import { HTMLAttributes } from 'react';

export default function ApplicationLogo(props: HTMLAttributes<HTMLElement>) {
    const { className = '', ...attrs } = props;
    return (
        <>
            <img
                src="/ul-logo-w.svg"
                alt="UnlockEd logo"
                {...attrs}
                className={`${className} logo-dark`}
            />
            <img
                src="/ul-logo-d.svg"
                alt="UnlockEd logo"
                {...attrs}
                className={`${className} logo-light`}
            />
        </>
    );
}
