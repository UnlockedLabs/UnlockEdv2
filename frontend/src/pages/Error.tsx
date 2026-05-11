import { Link } from 'react-router-dom';
import { ErrorType } from '@/types';

export default function Error({ type, back }: { type?: ErrorType; back?: boolean }) {
    const getMessage = () => {
        switch (type) {
            case 'not-found':
                return { title: '404', description: 'Page not found' };
            case 'unauthorized':
                return {
                    title: '403',
                    description: 'You are not authorized to view this page'
                };
            default:
                return {
                    title: 'Error',
                    description: 'Something went wrong'
                };
        }
    };

    const { title, description } = getMessage();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <h1 className="text-4xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
            {back ? (
                <button
                    onClick={() => window.history.back()}
                    className="text-primary underline"
                >
                    Go back
                </button>
            ) : (
                <Link to="/" className="text-primary underline">
                    Return home
                </Link>
            )}
        </div>
    );
}
