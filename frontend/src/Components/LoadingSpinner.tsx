interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
    centered?: boolean;
    overlay?: boolean;
}

export default function LoadingSpinner({
    size = 'md',
    text = 'Loading...',
    className = '',
    centered = false,
    overlay = false
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'loading-sm',
        md: 'loading-md',
        lg: 'loading-lg'
    };

    const spinnerContent = (
        <div
            className={`flex gap-4 justify-center items-center ${overlay ? 'text-grey-4 bg-grey-1 p-4 rounded-md shadow-lg' : ''} ${className}`}
        >
            <span
                className={`loading loading-spinner ${sizeClasses[size]}`}
            ></span>
            {text && <p className="text-lg">{text}</p>}
        </div>
    );

    if (centered) {
        return (
            <div className="flex justify-center items-center py-12">
                {spinnerContent}
            </div>
        );
    }

    return spinnerContent;
}
