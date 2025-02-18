import { AUTHCALLBACK } from '@/useAuth';

export default function Error() {
    return (
        <>
            <div title="Error" />
            <div className="text-center">
                <div className="mb-4 font-medium text-sm text-green-600">
                    Either there has been an unexpected error, or the page you
                    requested was not found.
                </div>
                <button
                    className="btn btn-primary btn-outline"
                    onClick={() => {
                        window.location.href = AUTHCALLBACK;
                    }}
                >
                    Home Page
                </button>
            </div>
        </>
    );
}
