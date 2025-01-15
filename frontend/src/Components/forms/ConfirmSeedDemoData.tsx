import { CloseX } from '../inputs';

export default function ConfirmSeedDemoDataForm({
    handleClose,
    inProgress,
    handleSeedDemoData
}: {
    handleClose: () => void;
    inProgress: boolean;
    handleSeedDemoData: () => Promise<void>;
}) {
    return (
        <div>
            <CloseX close={handleClose} />
            <div className="text-md font-semibold pb-6 text-neutral">
                Are you sure you want to seed demo data?
                <br />
                <strong>NOTE:</strong>
                <br />
                This will not create new courses, content, or users.
                <br />
                First map users with a provider and wait for the courses to
                finish importing before seeding demo data.
            </div>
            {inProgress && (
                <>
                    <div className="text-lg font-semibold pb-6 text-red-400">
                        Seeding demo data, please wait...
                    </div>
                    <svg
                        className="animate-spin h-10 w-10 text-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                </>
            )}
            <div className="flex flex-row justify-between">
                <button
                    disabled={inProgress}
                    onClick={() => {
                        void handleSeedDemoData();
                    }}
                    className="button"
                >
                    Confirm
                </button>
            </div>
        </div>
    );
}
