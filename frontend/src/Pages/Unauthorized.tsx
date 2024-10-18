export default function UnauthorizedNotFound({ which }: { which: string }) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="card content-center shadow-md w-96">
                <div className="text-center card-body">
                    <div className="mb-4 font-medium text-sm text-green-600">
                        {which === 'unauthorized'
                            ? `You are not authorized to view this page, please contact your administrator if you believe
                you have reached this page in error.`
                            : `The page you requested was not found`}
                    </div>
                    <button
                        className="btn btn-primary btn-outline"
                        onClick={() => {
                            window.location.href = '/dashboard';
                        }}
                    >
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
