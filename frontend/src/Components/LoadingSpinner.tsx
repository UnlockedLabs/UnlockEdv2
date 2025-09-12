interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
}

export default function LoadingSpinner({
    size = 'md',
    text = 'Loading...',
    className = ''
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'loading-sm',
        md: 'loading-md',
        lg: 'loading-lg'
    };

    return (
        <div className={`flex gap-4 justify-center items-center ${className}`}>
            <span
                className={`loading loading-spinner ${sizeClasses[size]}`}
            ></span>
            {text && <p className="text-lg">{text}</p>}
        </div>
    );
}
