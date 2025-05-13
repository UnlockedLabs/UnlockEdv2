import { AUTHCALLBACK } from '@/useAuth';
import { ErrorType } from '@/common';
import { useNavigate } from 'react-router-dom';

interface ErrorPageProps {
    type?: ErrorType;
    back?: boolean;
    message?: string;
    navigateTo?: string;
}

const errorMap: Record<
    ErrorType,
    { message: string; buttonText: string; onClick: () => void }
> = {
    unauthorized: {
        message:
            'You do not have permission to access this page. Contact your administrator if you believe you have reached this page in error.',
        buttonText: 'Home Page',
        onClick: () => (window.location.href = AUTHCALLBACK)
    },
    'not-found': {
        message: 'The page you requested does not exist.',
        buttonText: 'Home Page',
        onClick: () => (window.location.href = AUTHCALLBACK)
    },
    'server-error': {
        message: 'An unexpected error occurred. Please try again later.',
        buttonText: 'Home Page',
        onClick: () => (window.location.href = AUTHCALLBACK)
    }
};
export default function Error({
    type = 'server-error',
    back = false,
    message: customMessage,
    navigateTo
}: ErrorPageProps) {
    const {
        message: defaultMessage,
        buttonText,
        onClick
    } = errorMap[type ?? 'server-error'];
    const navigate = useNavigate();
    const label = back ? 'Go Back' : buttonText;
    const displayMessage = customMessage ?? defaultMessage;
    const clickHandler = navigateTo
        ? () => navigate(navigateTo)
        : back
          ? () => navigate(-1)
          : onClick;

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="card w-96 shadow-md ">
                <div className="card-body text-center">
                    <div className="mb-4 font-medium text-sm text-error">
                        {displayMessage}
                    </div>
                    <button
                        className="button-outline mx-auto"
                        onClick={clickHandler}
                    >
                        {label}
                    </button>
                </div>
            </div>
        </div>
    );
}
